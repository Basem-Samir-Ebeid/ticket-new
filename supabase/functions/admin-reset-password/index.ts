import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get both Authorization header and apikey
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('apikey')
    
    console.log('Headers received:', {
      hasAuth: !!authHeader,
      hasApiKey: !!apiKey,
      authPreview: authHeader?.substring(0, 30)
    })

    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    if (!serviceRoleKey) {
      return Response.json({ 
        error: 'Service role key not configured. Run: supabase secrets set SERVICE_ROLE_KEY=your_key' 
      }, { status: 500, headers: corsHeaders })
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Extract JWT - could be in Authorization header or as a separate apikey
    let jwt = null
    
    if (authHeader?.startsWith('Bearer ')) {
      jwt = authHeader.replace('Bearer ', '')
    }

    console.log('JWT check:', {
      hasJWT: !!jwt,
      jwtPreview: jwt?.substring(0, 30)
    })

    if (!jwt) {
      return Response.json({ 
        error: 'No JWT token found in request' 
      }, { status: 401, headers: corsHeaders })
    }

    // Verify the JWT token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt)

    console.log('User verification:', {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message
    })

    if (userError || !user) {
      return Response.json({ 
        error: `Authentication failed: ${userError?.message || 'Invalid token'}` 
      }, { status: 401, headers: corsHeaders })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('Profile check:', {
      hasProfile: !!profile,
      role: profile?.role,
      error: profileError?.message
    })

    if (profileError) {
      return Response.json({ 
        error: `Failed to fetch user profile: ${profileError.message}` 
      }, { status: 500, headers: corsHeaders })
    }

    if (profile?.role !== 'admin') {
      return Response.json({ 
        error: 'Only admins can reset passwords' 
      }, { status: 403, headers: corsHeaders })
    }

    // Parse request body
    const { userId, newPassword } = await req.json()

    console.log('Reset request:', {
      targetUserId: userId,
      hasPassword: !!newPassword,
      passwordLength: newPassword?.length
    })

    if (!userId || !newPassword) {
      return Response.json({ 
        error: 'userId and newPassword are required' 
      }, { status: 400, headers: corsHeaders })
    }

    if (String(newPassword).length < 6) {
      return Response.json({ 
        error: 'Password must be at least 6 characters' 
      }, { status: 400, headers: corsHeaders })
    }

    // Reset the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Password update failed:', updateError)
      return Response.json({ 
        error: `Failed to update password: ${updateError.message}` 
      }, { status: 400, headers: corsHeaders })
    }

    console.log('Password reset successful for user:', userId)
    
    return Response.json({ 
      success: true,
      message: 'Password updated successfully' 
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500, headers: corsHeaders })
  }
})