import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Systeme.io Webhook Handler
// Receives "contact.tag_added" and "contact.tag_removed" events
// Full spec in KLARO_Technical_Brief.md → Section 6

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const supabase = createAdminClient()

    const email = payload?.contact?.email
    const tagName = payload?.tag?.name
    const eventType = payload?.event_type

    // Log the webhook
    await supabase.from('webhook_logs').insert({
      payload,
      tag_name: tagName,
      contact_email: email,
      action: 'received',
    })

    if (!email || !tagName) {
      return NextResponse.json({ error: 'Missing email or tag' }, { status: 400 })
    }

    const ACCESS_TAG = process.env.SYSTEME_ACCESS_TAG || 'KLARO-FULLPAY'
    const ENROLLED_TAG = process.env.SYSTEME_ENROLLED_TAG || 'KLARO-ENROLLED'

    // Handle FULL ACCESS tag
    if (tagName === ACCESS_TAG) {
      if (eventType === 'contact.tag_added') {
        // Grant full access — find user by email and update their profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, enrolled_at')
          .eq('email', email)
          .single()

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              access_level: 'full_access',
              full_access_granted_at: new Date().toISOString(),
              enrolled_at: profile.enrolled_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id)

          await supabase.from('webhook_logs').insert({
            payload,
            tag_name: tagName,
            contact_email: email,
            action: 'access_granted',
          })
        } else {
          // User hasn't signed up yet — create a pending profile record
          // They'll complete signup later and the profile will link via trigger
          await supabase.from('webhook_logs').insert({
            payload,
            tag_name: tagName,
            contact_email: email,
            action: 'access_granted_pending_signup',
          })
        }
      }

      if (eventType === 'contact.tag_removed') {
        // Revoke access
        await supabase
          .from('profiles')
          .update({ access_level: 'pending', updated_at: new Date().toISOString() })
          .eq('email', email)

        await supabase.from('webhook_logs').insert({
          payload,
          tag_name: tagName,
          contact_email: email,
          action: 'access_revoked',
        })
      }
    }

    // Handle ENROLLED tag (partial payment)
    if (tagName === ENROLLED_TAG) {
      if (eventType === 'contact.tag_added') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              access_level: 'enrolled',
              enrolled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id)

          await supabase.from('webhook_logs').insert({
            payload,
            tag_name: tagName,
            contact_email: email,
            action: 'enrolled',
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
