import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function VerifyEmail() {
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const runVerification = async () => {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get("uid");
      const token = params.get("token");

      if (!uid || !token) {
        setStatus("error");
        setMessage("Thieu thong tin xac thuc. Vui long kiem tra lai lien ket.");
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/verify?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Xac thuc that bai.");
        }

        setStatus("success");
        setMessage(
          data.message || "Xac thuc thanh cong. Ban co the dang nhap ngay."
        );
      } catch (error) {
        console.error(error);
        setStatus("error");
        setMessage(error.message || "Co loi xay ra khi xac thuc.");
      }
    };

    runVerification();
  }, []);

  return (
    <section className="verify-email-page" style={{ padding: "2rem" }}>
      <h2>Xac thuc tai khoan</h2>

      {status === "checking" ? <p>Dang kiem tra lien ket...</p> : null}

      {status === "success" ? (
        <div className="success" style={{ color: "green" }}>
          <p>{message}</p>
          <a href="/" className="phurai-button">
            Ve trang chu
          </a>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="error" style={{ color: "red" }}>
          <p>{message}</p>
          <a href="/register" className="phurai-button">
            Dang ky lai
          </a>
        </div>
      ) : null}
    </section>
  );
}

export default VerifyEmail;
