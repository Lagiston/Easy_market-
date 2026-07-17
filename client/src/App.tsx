import { Route, Routes } from "react-router";
import { Role } from "@es-market/core";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import ProductsPage from "./pages/ProductsPage";
import DashboardPage from "./pages/DashboardPage";
import CategoriesPage from "./pages/CategoriesPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route element={<ProtectedRoute roles={[Role.ADMIN]} />}>
        <Route path="/users" element={<UsersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
