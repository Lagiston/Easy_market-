import { Route, Routes } from "react-router";
import { Role } from "@es-market/core";
import ProtectedRoute from "./components/ProtectedRoute";
import StorefrontLayout from "./components/storefront/StorefrontLayout";
import StorefrontHomePage from "./pages/storefront/HomePage";
import StorefrontProductsPage from "./pages/storefront/ProductsPage";
import StorefrontProductDetailPage from "./pages/storefront/ProductDetailPage";
import StorefrontContactPage from "./pages/storefront/ContactPage";
import StorefrontCartPage from "./pages/storefront/CartPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import DashboardPage from "./pages/DashboardPage";
import CategoriesPage from "./pages/CategoriesPage";

function App() {
  return (
    <Routes>
      <Route element={<StorefrontLayout />}>
        <Route index element={<StorefrontHomePage />} />
        <Route path="products" element={<StorefrontProductsPage />} />
        <Route path="products/:id" element={<StorefrontProductDetailPage />} />
        <Route path="contact" element={<StorefrontContactPage />} />
        <Route path="cart" element={<StorefrontCartPage />} />
      </Route>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute />}>
        <Route index element={<HomePage />} />
      </Route>
      <Route path="/admin" element={<ProtectedRoute roles={[Role.ADMIN]} />}>
        <Route path="users" element={<UsersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="categories" element={<CategoriesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
