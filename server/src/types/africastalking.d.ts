// The `africastalking` package ships no TypeScript types (plain CommonJS,
// no `.d.ts` anywhere in the published package) — this ambient declaration
// covers only the SMS surface this server actually calls.
declare module "africastalking" {
  interface SmsSendParams {
    to: string | string[];
    message: string;
    from?: string;
  }

  interface SmsRecipient {
    number: string;
    status: string;
    statusCode: number;
    cost: string;
    messageId: string;
  }

  interface SmsSendResult {
    SMSMessageData: {
      Message: string;
      Recipients: SmsRecipient[];
    };
  }

  interface SmsApi {
    send(params: SmsSendParams): Promise<SmsSendResult>;
  }

  interface AfricasTalkingClient {
    SMS: SmsApi;
  }

  export default function AfricasTalking(options: {
    username: string;
    apiKey: string;
  }): AfricasTalkingClient;
}
