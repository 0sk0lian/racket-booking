/**
 * Notification system.
 * Stores in-app notifications and optionally sends email.
 * Email sending is best-effort — failure doesn't block the operation.
 */
import { createSupabaseAdminClient } from './supabase/server';

interface NotificationParams {
  userId: string;
  clubId?: string;
  type: string; // 'booking.confirmed', 'membership.approved', 'training.cancelled', etc.
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  sendEmail?: boolean;
}

export async function sendNotification(params: NotificationParams) {
  const supabase = createSupabaseAdminClient();

  // Store in-app notification
  await supabase.from('notifications').insert({
    user_id: params.userId,
    club_id: params.clubId ?? null,
    type: params.type,
    title: params.title,
    body: params.body,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    read: false,
  });

  // Send email if requested and Resend API key is configured
  if (params.sendEmail && process.env.RESEND_API_KEY) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', params.userId)
        .single();

      if (user?.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? 'Racket Booking <no-reply@racketbooking.se>',
            to: user.email,
            subject: params.title,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#4f46e5">${params.title}</h2>
              <p style="color:#475569;line-height:1.6">${params.body}</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Racket Booking</p>
            </div>`,
          }),
        });
      }
    } catch {
      // Email failure is non-blocking
    }
  }
}

/**
 * Send notification to all members of a club.
 */
export async function notifyClubMembers(params: {
  clubId: string;
  type: string;
  title: string;
  body: string;
  sendEmail?: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: members } = await supabase
    .from('club_memberships')
    .select('user_id')
    .eq('club_id', params.clubId)
    .eq('status', 'active');

  for (const member of members ?? []) {
    await sendNotification({
      userId: member.user_id,
      clubId: params.clubId,
      type: params.type,
      title: params.title,
      body: params.body,
      sendEmail: params.sendEmail,
    });
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
}
