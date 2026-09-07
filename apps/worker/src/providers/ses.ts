import {
  SESClient,
  SendEmailCommand,
  type SESClientConfig,
} from "@aws-sdk/client-ses";
import type { SendEmailInput } from "./types.js";

export function buildSesClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): SESClientConfig {
  const region = env.AWS_REGION ?? "eu-west-1";
  const endpoint = env.AWS_ENDPOINT;
  const accessKeyId = env.AWS_ACCESS_KEY_ID ?? "test";
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY ?? "test";

  return {
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
}

export async function sendEmailViaSes(
  input: SendEmailInput,
  env: NodeJS.ProcessEnv = process.env,
  client = new SESClient(buildSesClientConfig(env)),
): Promise<string> {
  const from = env.SMTP_FROM ?? "pingora@localhost";

  const result = await client.send(
    new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [input.to],
      },
      Message: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: input.body, Charset: "UTF-8" },
        },
      },
    }),
  );

  if (!result.MessageId) {
    throw new Error("SES SendEmail returned no MessageId");
  }

  return result.MessageId;
}
