import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async () => {
  try {
    const phone = "18888888888";
    const email = `${phone}@system.internal`;
    const password = "root@123";
    const roleId = "d4d6da2c-c9c1-4b46-8796-5d671b037d8e";

    // Check if profile already exists
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, message: "该手机号管理员账号已存在，请直接登录" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Try to find existing auth user by email (in case auth user was created but profile failed)
    const { data: listData } = await admin.auth.admin.listUsers();
    const existingAuthUser = listData?.users?.find(u => u.email === email);

    let authUserId: string;

    if (existingAuthUser) {
      // Auth user already exists, update password
      await admin.auth.admin.updateUserById(existingAuthUser.id, { password });
      authUserId = existingAuthUser.id;
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ success: false, message: authError?.message || "创建Auth用户失败" }),
          { headers: { "Content-Type": "application/json" }, status: 500 }
        );
      }
      authUserId = authData.user.id;
    }

    // Insert user_profile with correct column name: real_name
    const { error: profileError } = await admin.from("user_profiles").insert({
      id: authUserId,
      phone,
      real_name: "超级管理员",
      role_id: roleId,
      is_active: true,
    });

    if (profileError) {
      return new Response(
        JSON.stringify({ success: false, message: "写入用户信息失败：" + profileError.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "管理员账号创建成功！手机号：18888888888，密码：root@123，请登录" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, message: String(e) }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
