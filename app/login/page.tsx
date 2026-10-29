import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login">
      <div className="brand" style={{ marginBottom: 24, fontSize: "1.25rem" }}>Client Ops</div>
      <LoginForm />
    </div>
  );
}
