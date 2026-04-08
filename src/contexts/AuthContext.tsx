import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface RolePermission {
  page_key: string;
  can_view: boolean;
  can_edit: boolean;
}

export interface UserProfile {
  id: string;
  phone: string;
  real_name: string;
  is_active: boolean;
  review_permission: 'none' | 'level1' | 'level2' | 'level3';
  role: {
    id: string;
    name: string;
    code: string;
  } | null;
  permissions: RolePermission[];
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  canView: (pageKey: string) => boolean;
  canEdit: (pageKey: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // 标记：profile 是否已经完成过一次加载（防止切换标签触发 SIGNED_IN 导致重新 loading）
  const hasLoadedProfile = useRef(false);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, phone, real_name, is_active, review_permission, roles(id, name, code), role_id")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) return null;

      const roleData = data.roles as { id: string; name: string; code: string } | null;

      let permissions: RolePermission[] = [];
      if (data.role_id) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("page_key, can_view, can_edit")
          .eq("role_id", data.role_id);
        permissions = perms || [];
      }

      return {
        id: data.id,
        phone: data.phone,
        real_name: data.real_name,
        is_active: data.is_active,
        review_permission: (data.review_permission as 'none' | 'level1' | 'level2' | 'level3') || 'none',
        role: roleData,
        permissions,
      } as UserProfile;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        // 退出登录：清空状态，重置标记
        setProfile(null);
        setLoading(false);
        hasLoadedProfile.current = false;
        clearTimeout(fallback);
      } else if (event === 'INITIAL_SESSION' || (event === 'SIGNED_IN' && !hasLoadedProfile.current)) {
        // 仅首次加载或真正的新登录时才进入 loading
        // 切换标签页触发的 SIGNED_IN（hasLoadedProfile 已为 true）直接跳过，保持页面现有状态
        setLoading(true);
      }
      // TOKEN_REFRESHED / USER_UPDATED / 切换标签页的 SIGNED_IN → 什么都不做
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  // Fetch profile whenever user changes — this is decoupled from onAuthStateChange
  // so signInWithPassword returns instantly without waiting for DB queries
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    fetchProfile(user.id).then((p) => {
      if (cancelled) return;
      setProfile(p);
      setLoading(false);
      hasLoadedProfile.current = true; // 标记首次加载完成
    });

    return () => { cancelled = true; };
  }, [user?.id]);

  const signIn = async (phone: string, password: string) => {
    try {
      const email = `${phone}@system.internal`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: "手机号或密码错误，请重试" };
      return { error: null };
    } catch {
      return { error: "登录失败，请稍后重试" };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const canView = (pageKey: string): boolean => {
    if (!profile) return false;
    if (profile.role?.code === "system_admin") return true;
    return profile.permissions.some(p => p.page_key === pageKey && p.can_view);
  };

  const canEdit = (pageKey: string): boolean => {
    if (!profile) return false;
    if (profile.role?.code === "system_admin") return true;
    return profile.permissions.some(p => p.page_key === pageKey && p.can_edit);
  };

  const isAdmin = (): boolean => profile?.role?.code === "system_admin";

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, canView, canEdit, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
