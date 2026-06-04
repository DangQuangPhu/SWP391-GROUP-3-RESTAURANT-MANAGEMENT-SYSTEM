import { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function Register() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    phone: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      setMessage(
        data.message ||
          (response.ok
            ? "Registration successful. Check your email."
            : "Registration failed.")
      );
    } catch (error) {
      console.error(error);
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="register-page" style={{ padding: "2rem" }}>
      <h2>Dang ky tai khoan</h2>
      <form
        onSubmit={handleSubmit}
        className="register-form"
        style={{ maxWidth: "400px" }}
      >
        <label>
          Ten dang nhap
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Mat khau
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Ho va ten
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
          />
        </label>
        <label>
          So dien thoai
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
        </label>
        <button type="submit" disabled={loading} className="phurai-button">
          {loading ? "Dang gui..." : "Dang ky"}
        </button>
      </form>
      {message ? (
        <p className="message" style={{ marginTop: "1rem" }}>
          {message}
        </p>
      ) : null}
    </section>
  );
}

export default Register;
