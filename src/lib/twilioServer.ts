import { createServerFn } from "@tanstack/react-start";
import type { AlertLog } from "./store";

export const triggerTwilioCall = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (Array.isArray(data)) return data as AlertLog[];
    return [data as AlertLog];
  })
  .handler(async ({ data: alerts }) => {
    const vapiPrivateKey = process.env.VAPI_PRIVATE_KEY;
    const vapiAssistantId = process.env.VAPI_ASSISTANT_ID;
    
    // You need to set a Vapi Phone Number ID in your .env if you want Vapi to dial real phones
    const vapiPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (!vapiPrivateKey || !vapiAssistantId) {
      console.error("Missing Vapi credentials in .env");
      return { success: false, error: "Missing Vapi credentials" };
    }

    try {
      if (alerts.length === 0) return { success: true };

      const speechParts = alerts.map(a => {
        let conditionText = `has a critical risk score of ${a.risk}.`;
        if (a.reasons && a.reasons.length > 0) {
          conditionText = a.reasons.join(". ")
            .replace(/SpO₂/g, "S P O 2")
            .replace(/bpm/g, "beats per minute")
            .replace(/—/g, ",")
            .replace(/°C/g, "degrees Celsius");
        }
        return `Patient ${a.patientName} in ${a.nurse.ward}, ${conditionText}.`;
      }).join(" ");

      const firstMessage = `Eagles Eye A.I. Alert. ${speechParts} Are you able to respond to this patient immediately?`;

      const auditLogs: any[] = [];
      const personNames: Record<string, string> = {
        '+919363179481': 'Doctor 1',
        '+919035890001': 'Doctor 2'
      };

      const escalationSequence = ['+919363179481', '+919035890001'];

      for (const toPhone of escalationSequence) {
        console.log(`Triggering Vapi Outbound call to ${toPhone}...`);
        const startTimeIst = new Date(Date.now() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30');

        let finalCallSid = "Failed";
        
        const payload: any = {
          assistantId: vapiAssistantId,
          customer: {
            number: toPhone,
          },
          assistantOverrides: {
            firstMessage: firstMessage,
          }
        };

        if (vapiPhoneNumberId) {
          payload.phoneNumberId = vapiPhoneNumberId;
        } else {
          console.warn("VAPI_PHONE_NUMBER_ID is not set in .env. Vapi might reject the outbound call.");
        }

        const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${vapiPrivateKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const vapiData = await vapiResponse.json();

        if (!vapiResponse.ok) {
          console.error("Vapi Outbound Call Failed:", vapiData);
        } else {
          console.log(`Vapi Call successfully queued! Call ID: ${vapiData.id}`);
          finalCallSid = vapiData.id;
        }

        const endTimeIst = new Date(Date.now() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30');

        auditLogs.push({
          call_sid: finalCallSid,
          call_status: vapiResponse.ok ? "queued" : "failed",
          answered: false, // Vapi doesn't return immediate answer status like Twilio polling did
          person_contacted: personNames[toPhone] || 'Doctor',
          phone: toPhone,
          patient: alerts.map(a => a.patientName).join(", ") || 'Unknown Patient',
          timestamp: startTimeIst,
          bed: alerts.map(a => a.nurse?.ward).join(", ") || 'ICU',
          condition: alerts.map(a => a.reasons?.[0] || 'Critical Condition').join(" | "),
          risk_score: alerts.length > 0 ? Math.max(...alerts.map(a => a.risk)) : 99,
          call_time: startTimeIst,
          response_time: endTimeIst,
          log: JSON.stringify({ vapiResponse: vapiData })
        });
        
        // Break after the first call attempt just to demonstrate. 
        // Real escalation requires webhook handling from Vapi to know if it was answered.
        break; 
      }

      return { success: true, auditLogs };
    } catch (error) {
      console.error("Vapi server error:", error);
      return { success: false, error: String(error) };
    }
  });
