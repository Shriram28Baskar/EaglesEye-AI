import { createServerFn } from "@tanstack/react-start";
import twilio from "twilio";
import type { AlertLog } from "./store";

export const triggerTwilioCall = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (Array.isArray(data)) return data as AlertLog[];
    return [data as AlertLog];
  })
  .handler(async ({ data: alerts }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
      console.error("Missing Twilio credentials");
      return { success: false, error: "Missing credentials" };
    }

    try {
      const client = twilio(accountSid, authToken);
      
      if (alerts.length === 0) return { success: true };

      const smsBody = alerts.map(a => `🚨 ALERT: Patient ${a.patientName} (${a.patientId})\nRisk: ${a.risk}%\nWard: ${a.nurse.ward}`).join("\n\n");

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

      const twiml = `
        <Response>
          <Say>Eagles Eye A.I. Alert. ${speechParts} Please respond immediately.</Say>
        </Response>
      `;

      const auditLogs: any[] = [];
      const personNames: Record<string, string> = {
        '+918124175061': 'Emily',
        '+918122914548': 'Michael',
        '+918667026446': 'Sarah'
      };

      const escalationSequence = ['+918124175061', '+918122914548', '+918667026446'];

      for (const toPhone of escalationSequence) {
        console.log(`Escalating alert to ${toPhone}...`);
        const startTime = new Date();
        // Shift time by +5:30 to match IST timezone output natively
        const startTimeIst = new Date(startTime.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30');
        
        let finalCallSid = "Failed/None";
        let finalStatus = "failed";
        let isAnswered = false;

        try {
          // Send automated WhatsApp Message (Concurrent, no await)
          client.messages.create({
            body: smsBody,
            to: `whatsapp:${toPhone}`,
            from: `whatsapp:+14155238886`, // Must use the universal Sandbox number for Trial accounts
          }).then(() => console.log(`WhatsApp message sent to ${toPhone}`))
            .catch((waErr: any) => console.error(`Failed to send WhatsApp to ${toPhone}:`, waErr.message || waErr));

          // Send SMS (Concurrent, no await)
          client.messages.create({
            body: smsBody,
            to: toPhone,
            from: fromPhone,
          }).catch((smsErr: any) => console.error(`Failed to send SMS to ${toPhone}:`, smsErr.message || smsErr));

          // Initiate the call with a 17-second timeout (7s for international routing + exactly 10s of ringing)
          const call = await client.calls.create({
            twiml,
            to: toPhone,
            from: fromPhone,
            timeout: 17,
          });
          
          finalCallSid = call.sid;

          let answered = false;
          let finished = false;

          // Poll call status every 2 seconds
          while (!finished) {
            await new Promise(r => setTimeout(r, 2000));
            const callStatus = (await client.calls(call.sid).fetch()).status;
            
            if (callStatus === 'in-progress' || callStatus === 'completed') {
              console.log(`Call answered by ${toPhone}! Stopping escalation.`);
              answered = true;
              finished = true;
              finalStatus = "completed";
              isAnswered = true;
            } else if (['no-answer', 'canceled', 'failed', 'busy'].includes(callStatus)) {
              console.log(`Call to ${toPhone} missed (${callStatus}). Escalating to next person...`);
              finished = true;
              finalStatus = callStatus;
            }
          }

          if (answered) {
            isAnswered = true;
          }
        } catch (err) {
          console.error(`Error reaching ${toPhone}:`, err);
          finalStatus = "error";
        }
        
        const endTime = new Date();
        const endTimeIst = new Date(endTime.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30');
        
        auditLogs.push({
          call_sid: finalCallSid,
          call_status: finalStatus,
          answered: isAnswered,
          person_contacted: personNames[toPhone] || 'Dr. Patel',
          phone: toPhone,
          patient: alerts.map(a => a.patientName).join(", ") || 'Unknown Patient',
          timestamp: startTimeIst,
          bed: alerts.map(a => a.nurse?.ward).join(", ") || 'ICU',
          condition: alerts.map(a => a.reasons?.[0] || 'Critical Condition').join(" | "),
          risk_score: alerts.length > 0 ? Math.max(...alerts.map(a => a.risk)) : 99,
          call_time: startTimeIst,
          response_time: endTimeIst,
          log: JSON.stringify({ execution_time: endTimeIst })
        });
        
        if (isAnswered) {
          break; // Stop escalating if someone answered
        }
      }

      const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      if (webhookUrl && auditLogs.length > 0) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(auditLogs)
          });
          console.log('Successfully pushed logs to Google Sheets');
        } catch (err: any) {
          console.error('Failed to push to Google Sheets:', err.message || err);
        }
      }

      return { success: true, auditLogs };
    } catch (error) {
      console.error("Twilio error:", error);
      return { success: false, error: String(error) };
    }
  });
