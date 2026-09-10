import { DashboardHome } from "../components/dashboard-home";
import { Providers } from "./providers";

export default function HomePage() {
  return (
    <Providers>
      <DashboardHome />
    </Providers>
  );
}
