import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) { setError("请填写手机号和密码"); return; }
    setLoading(true); setError("");
    const { error: err } = await signIn(phone.trim(), password.trim());
    if (err) { setError(err); setLoading(false); return; }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <i className="ri-bar-chart-box-line text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-800">米均效益评价系统</h1>
              <p className="text-xs text-gray-500">济南历下区</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">登录账号</h2>
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
              <i className="ri-error-warning-line"></i>{error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
              <div className="relative">
                <i className="ri-smartphone-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="请输入手机号" maxLength={11}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <div className="relative">
                <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                  <i className={showPwd ? "ri-eye-off-line" : "ri-eye-line"}></i>
                </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {loading ? <><i className="ri-loader-4-line animate-spin mr-1.5"></i>登录中…</> : "登录"}
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-400 text-center">如需账号请联系系统管理员创建</p>
        </div>
      </div>
    </div>
  );
}
