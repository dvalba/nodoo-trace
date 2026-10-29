// src/invitations/templates/invitation-email.template.ts
import { UserRole } from '../../users/enums/roles.enum.js';

export interface InvitationEmailParams {
  actorName: string;
  inviterEmail: string;
  roles: UserRole[];
  inviteUrl: string;
  expiresAt: Date;
  mode: 'invite' | 'verify';
}

export function invitationEmailTemplate(params: InvitationEmailParams): string {
  const { actorName, inviterEmail, roles, inviteUrl, expiresAt, mode } = params;
  const isVerify = mode === 'verify';

  const rolesLabel = roles
    .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
    .join(', ');

  const expiresLabel = expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1e293b;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">
                You've been invited
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px 0;color:#1e293b;font-size:16px;line-height:1.6;">
                ${
                  isVerify
                    ? `Welcome to <strong>${escapeHtml(actorName)}</strong>`
                    : `<strong>${escapeHtml(inviterEmail)}</strong> invited you to join <strong>${escapeHtml(actorName)}</strong> ${roles.length === 1 ? 'as' : 'with the roles'} <strong>${escapeHtml(rolesLabel)}</strong>`
                }
                .
              </p>

              <p style="margin:0 0 32px 0;color:#475569;font-size:15px;line-height:1.6;">
                ${
                  isVerify
                    ? 'Click the button below to verify your email and activate your account.'
                    : 'Click the button below to accept the invitation and create your account.'
                }
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px auto;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#2563eb;">
                    <a href="${escapeHtml(inviteUrl)}"
                       target="_blank"
                       rel="noopener noreferrer"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:6px;">
                       ${isVerify ? 'Verify email' : 'Accept invitation'}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;color:#64748b;font-size:13px;line-height:1.5;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 32px 0;word-break:break-all;">
                <a href="${escapeHtml(inviteUrl)}"
                   style="color:#2563eb;font-size:13px;text-decoration:underline;">
                  ${escapeHtml(inviteUrl)}
                </a>
              </p>

              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
                This invitation expires on <strong>${escapeHtml(expiresLabel)}</strong>.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px 40px;">
                <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                ${
                  isVerify
                    ? 'You are receiving this email because your organization registration is waiting for email verification.'
                    : "If you weren't expecting this invitation, you can safely ignore this email. No account will be created until you click the button above."
                }
                </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
