import { Navigate, Route, Routes } from "react-router";
import { Role } from "@es-market/core";
import ProtectedRoute from "./components/ProtectedRoute";
import CustomerProtectedRoute from "./components/CustomerProtectedRoute";
import StorefrontLayout from "./components/storefront/StorefrontLayout";
import StorefrontHomePage from "./pages/storefront/HomePage";
import StorefrontProductsPage from "./pages/storefront/ProductsPage";
import StorefrontProductDetailPage from "./pages/storefront/ProductDetailPage";
import StorefrontContactPage from "./pages/storefront/ContactPage";
import StorefrontAboutPage from "./pages/storefront/AboutPage";
import StorefrontPolicyPage from "./pages/storefront/PolicyPage";
import StorefrontCartPage from "./pages/storefront/CartPage";
import StorefrontCheckoutPage from "./pages/storefront/CheckoutPage";
import StorefrontOrderConfirmationPage from "./pages/storefront/OrderConfirmationPage";
import StorefrontTrackPage from "./pages/storefront/TrackPage";
import StorefrontAccountLoginPage from "./pages/storefront/AccountLoginPage";
import StorefrontAccountSignUpPage from "./pages/storefront/AccountSignUpPage";
import StorefrontAccountPage from "./pages/storefront/AccountPage";
import StorefrontAccountProfilePage from "./pages/storefront/AccountProfilePage";
import StorefrontAccountOrdersPage from "./pages/storefront/AccountOrdersPage";
import StorefrontAccountWishlistPage from "./pages/storefront/AccountWishlistPage";
import SettingsPage from "./pages/SettingsPage";
import SiteContentPage from "./pages/SiteContentPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import InquiriesPage from "./pages/InquiriesPage";
import InquiryDetailPage from "./pages/InquiryDetailPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CategoriesPage from "./pages/CategoriesPage";
import KbArticlesPage from "./pages/KbArticlesPage";
import PromoBlocksPage from "./pages/PromoBlocksPage";
import ReviewsPage from "./pages/ReviewsPage";

function App() {
  return (
    <Routes>
      <Route element={<StorefrontLayout />}>
        <Route index element={<StorefrontHomePage />} />
        <Route path="products" element={<StorefrontProductsPage />} />
        <Route path="products/:id" element={<StorefrontProductDetailPage />} />
        <Route path="about" element={<StorefrontAboutPage />} />
        <Route path="policy" element={<StorefrontPolicyPage />} />
        <Route path="contact" element={<StorefrontContactPage />} />
        <Route path="cart" element={<StorefrontCartPage />} />
        <Route path="checkout" element={<StorefrontCheckoutPage />} />
        <Route path="checkout/confirmation" element={<StorefrontOrderConfirmationPage />} />
        <Route path="track" element={<StorefrontTrackPage />} />
        {/* Short, SMS-friendly deep link (e.g. halatu.co.tz/t/9TWMY5ZN) —
            TrackPage reads the :code param itself. */}
        <Route path="t/:code" element={<StorefrontTrackPage />} />
        {/* "Order status" and "Message status" merged into one Track page —
            old links/bookmarks still land somewhere useful. */}
        <Route path="order-status" element={<Navigate to="/track" replace />} />
        <Route path="inquiry-status" element={<Navigate to="/track" replace />} />
        <Route path="account/login" element={<StorefrontAccountLoginPage />} />
        <Route path="account/signup" element={<StorefrontAccountSignUpPage />} />
        <Route element={<CustomerProtectedRoute />}>
          <Route path="account" element={<StorefrontAccountPage />} />
          <Route path="account/profile" element={<StorefrontAccountProfilePage />} />
          <Route path="account/orders" element={<StorefrontAccountOrdersPage />} />
          <Route path="account/wishlist" element={<StorefrontAccountWishlistPage />} />
        </Route>
      </Route>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute />}>
        <Route index element={<HomePage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="inquiries" element={<InquiriesPage />} />
        <Route path="inquiries/:id" element={<InquiryDetailPage />} />
      </Route>
      <Route path="/admin" element={<ProtectedRoute roles={[Role.ADMIN]} />}>
        <Route path="users" element={<UsersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="kb-articles" element={<KbArticlesPage />} />
        <Route path="promo-blocks" element={<PromoBlocksPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="site-content" element={<SiteContentPage />} />
      </Route>
    </Routes>
  );
}

export default App;
