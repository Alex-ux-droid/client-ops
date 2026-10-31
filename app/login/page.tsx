import Cosmos from "./Cosmos";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login">
      <Cosmos />
      <div className="login-card">
        <img src="/icons/icon.svg" alt="" className="login-logo" width={56} height={56} />
        <h1 className="login-title">Client Ops</h1>
        <p className="login-sub">З поверненням, Саша. Всесвіт на місці.</p>
        <LoginForm />
      </div>
    </div>
  );
}
