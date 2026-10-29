import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login">
      <div className="nav-brand" style={{ display: "block", padding: 0, marginBottom: 24 }}>CLIENT<span>/</span>OPS</div>
      <LoginForm />
    </div>
  );
}
