// FILE: emails/beta_invite.html.ts

interface InviteEmailProps {
  acceptUrl: string;
  pixelUrl: string;
}

export const createBetaInviteEmail = ({ acceptUrl, pixelUrl }: InviteEmailProps): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>You're Invited to the TagnetIQ Beta!</title>
    </head>
    <body style="font-family: sans-serif; text-align: center; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background-color: #fff; padding: 20px; border-radius: 8px;">
        <h2>You're Invited!</h2>
        <p>You've been invited to join the exclusive beta for TagnetIQ, the AI-powered resale assistant.</p>
        <a href="${acceptUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Accept Invite</a>
        <p style="font-size: 12px; color: #777;">If you're not expecting this, please disregard this email.</p>
      </div>
      <img src="${pixelUrl}" width="1" height="1" alt="" />
    </body>
    </html>
  `;
};