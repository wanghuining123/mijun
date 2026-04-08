import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 通过 Admin REST API 按邮箱查找 Auth 用户（listUsers 分页遍历）
async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    const found = data.users.find((u: { email?: string; id: string }) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 1000) break; // 最后一页
    page++;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "未提供认证 Token" }), { status: 401, headers: corsHeaders });
  }

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Token 无效或已过期，请重新登录" }), { status: 401, headers: corsHeaders });
  }

  const { data: profileData } = await supabaseAdmin
    .from("user_profiles")
    .select("role_id")
    .eq("id", user.id)
    .maybeSingle();

  let roleCode: string | null = null;
  if (profileData?.role_id) {
    const { data: roleData } = await supabaseAdmin
      .from("roles")
      .select("code")
      .eq("id", profileData.role_id)
      .maybeSingle();
    roleCode = roleData?.code ?? null;
  }

  if (roleCode !== "system_admin") {
    return new Response(
      JSON.stringify({ error: `权限不足：当前角色为 ${roleCode ?? "未分配"}，需要系统管理员权限` }),
      { status: 403, headers: corsHeaders }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体格式错误" }), { status: 400, headers: corsHeaders });
  }

  const { action, userId, phone, password, realName, roleId, isActive, reviewPermission } = body as Record<string, string>;

  // ── 创建用户 ──────────────────────────────────────────────
  if (action === "create") {
    if (!phone || !password) {
      return new Response(JSON.stringify({ error: "手机号和密码不能为空" }), { status: 400, headers: corsHeaders });
    }
    const email = `${phone}@system.internal`;

    // 1. 检查 user_profiles 是否已有该手机号（正式注册的用户）
    const { data: existingProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: "该手机号已被注册" }), { status: 400, headers: corsHeaders });
    }

    // 辅助函数：为指定 Auth 用户 ID 建立 Profile 并重置密码
    const recoverOrphan = async (orphanId: string): Promise<Response | null> => {
      // 重置密码
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(orphanId, { password });
      if (pwErr) {
        return new Response(
          JSON.stringify({ error: "重置账号密码失败：" + pwErr.message }),
          { status: 500, headers: corsHeaders }
        );
      }
      // 补建 Profile
      const { error: profileErr } = await supabaseAdmin.from("user_profiles").insert({
        id: orphanId,
        phone,
        real_name: realName || null,
        role_id: roleId || null,
        is_active: true,
        review_permission: reviewPermission || "none",
        created_by: user.id,
      });
      if (profileErr) {
        return new Response(
          JSON.stringify({ error: "恢复用户档案失败：" + profileErr.message }),
          { status: 500, headers: corsHeaders }
        );
      }
      return null; // null 表示成功
    };

    // 2. 直接尝试创建 Auth 用户
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      // 仅处理"邮箱已存在"类型的错误（僵尸账号场景）
      const isAlreadyExists =
        authErr.message.includes("already been registered") ||
        authErr.message.includes("already registered") ||
        authErr.message.includes("already exists");

      if (!isAlreadyExists) {
        return new Response(JSON.stringify({ error: "创建账号失败：" + authErr.message }), { status: 400, headers: corsHeaders });
      }

      // 找到孤儿账号的 ID
      const orphanId = await findAuthUserByEmail(supabaseAdmin, email);
      if (!orphanId) {
        return new Response(
          JSON.stringify({ error: "该手机号存在冲突但无法定位，请联系管理员处理" }),
          { status: 500, headers: corsHeaders }
        );
      }

      // 尝试删除孤儿账号
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(orphanId);

      if (delErr) {
        // 删不掉（有外键关联历史数据），改为原地恢复：补 Profile + 重置密码
        const recoverErr = await recoverOrphan(orphanId);
        if (recoverErr) return recoverErr;
        return new Response(
          JSON.stringify({ success: true, userId: orphanId, recovered: true }),
          { headers: corsHeaders }
        );
      }

      // 删除成功，重新创建
      const { data: retryData, error: retryErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (retryErr) {
        return new Response(JSON.stringify({ error: "重试创建失败：" + retryErr.message }), { status: 400, headers: corsHeaders });
      }

      // 写入 Profile
      const { error: profileErr } = await supabaseAdmin.from("user_profiles").insert({
        id: retryData.user.id,
        phone,
        real_name: realName || null,
        role_id: roleId || null,
        is_active: true,
        review_permission: reviewPermission || "none",
        created_by: user.id,
      });
      if (profileErr) {
        await supabaseAdmin.auth.admin.deleteUser(retryData.user.id);
        return new Response(JSON.stringify({ error: "保存用户信息失败：" + profileErr.message }), { status: 400, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: true, userId: retryData.user.id }), { headers: corsHeaders });
    }

    // 3. 正常创建成功，写入 Profile
    const { error: profileErr } = await supabaseAdmin.from("user_profiles").insert({
      id: authData.user.id,
      phone,
      real_name: realName || null,
      role_id: roleId || null,
      is_active: true,
      review_permission: reviewPermission || "none",
      created_by: user.id,
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: "保存用户信息失败：" + profileErr.message }), { status: 400, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ success: true, userId: authData.user.id }), { headers: corsHeaders });
  }

  // ── 更新用户 ──────────────────────────────────────────────
  if (action === "update") {
    if (!userId) return new Response(JSON.stringify({ error: "缺少 userId" }), { status: 400, headers: corsHeaders });
    const updates: Record<string, unknown> = {};
    if (realName !== undefined) updates.real_name = realName;
    if (roleId !== undefined) updates.role_id = roleId;
    if (isActive !== undefined) updates.is_active = isActive;
    if (reviewPermission !== undefined) updates.review_permission = reviewPermission;
    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin.from("user_profiles").update(updates).eq("id", userId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    }
    if (password) {
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (pwErr) return new Response(JSON.stringify({ error: pwErr.message }), { status: 400, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // ── 删除用户 ──────────────────────────────────────────────
  if (action === "delete") {
    if (!userId) return new Response(JSON.stringify({ error: "缺少 userId" }), { status: 400, headers: corsHeaders });
    await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // ── 列出用户 ──────────────────────────────────────────────
  if (action === "list") {
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("id, phone, real_name, is_active, created_at, role_id, review_permission, roles(id, name, code)")
      .order("created_at", { ascending: false });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    return new Response(JSON.stringify({ data }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "未知操作: " + action }), { status: 400, headers: corsHeaders });
});
