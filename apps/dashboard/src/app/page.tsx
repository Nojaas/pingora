import { Providers } from "./providers";
import { DashboardHome } from "../components/dashboard-home";

export default function HomePage() {
  return (
    <Providers>
      <DashboardHome />
    </Providers>
  );
}
