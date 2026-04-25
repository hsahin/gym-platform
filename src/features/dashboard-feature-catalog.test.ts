import { describe, expect, it } from "vitest";
import {
  DASHBOARD_FEATURE_CATALOG,
  getDashboardFeaturesForPage,
} from "@/features/dashboard-feature-catalog";

describe("dashboard feature catalog", () => {
  it("covers the full multi-gym feature matrix from the product brief", () => {
    expect(DASHBOARD_FEATURE_CATALOG).toHaveLength(40);
    expect(
      DASHBOARD_FEATURE_CATALOG.map((feature) => [feature.categoryTitle, feature.title]),
    ).toEqual([
      ["Manage Your Business", "Membership Management"],
      ["Manage Your Business", "Staff Management"],
      ["Manage Your Business", "24/7 Gym Access System"],
      ["Manage Your Business", "Studio Check-in Software"],
      ["Manage Your Business", "Advanced Analytics"],
      ["Manage Your Business", "Multi-Club Management"],
      ["Manage Your Business", "Webshop & PoS"],
      ["Booking Options", "Scheduling Software"],
      ["Booking Options", "Group Class Booking"],
      ["Booking Options", "1-1 Appointment Booking"],
      ["Booking Options", "Online Trial Booking"],
      ["Booking Options", "Credit System"],
      ["Coach Your Clients", "Workout Plan Creator"],
      ["Coach Your Clients", "Nutrition Coaching"],
      ["Coach Your Clients", "On Demand Videos"],
      ["Coach Your Clients", "Progress Tracking"],
      ["Coach Your Clients", "Heart Rate Coaching"],
      ["Coach Your Clients", "MAX AI Coach"],
      ["Retain Your Customers", "Retention Planner"],
      ["Retain Your Customers", "Community & Groups"],
      ["Retain Your Customers", "Challenges & Rewards"],
      ["Retain Your Customers", "Questionnaire"],
      ["Retain Your Customers", "PRO+ Content"],
      ["Retain Your Customers", "FitZone"],
      ["Billing Your Clients", "Payment Processing"],
      ["Billing Your Clients", "Credit Card Payments"],
      ["Billing Your Clients", "Direct Debit Processing"],
      ["Billing Your Clients", "AutoCollect"],
      ["Your Mobile App", "White Label App"],
      ["Your Mobile App", "Fitness Coaching App"],
      ["Your Mobile App", "Nutrition Coaching App"],
      ["Your Mobile App", "Mobile Check-in"],
      ["Marketing Tools", "Email Marketing"],
      ["Marketing Tools", "In-app Promotions"],
      ["Marketing Tools", "Lead Management"],
      ["Integrations", "Supported Hardware"],
      ["Integrations", "Software Integrations"],
      ["Integrations", "Equipment Integrations"],
      ["Integrations", "Virtuagym Connect"],
      ["Integrations", "Body Composition"],
    ]);
  });

  it("marks only the intended launch features as NEW", () => {
    expect(
      DASHBOARD_FEATURE_CATALOG.filter((feature) => feature.badgeLabel === "NEW").map(
        (feature) => feature.title,
      ),
    ).toEqual(["MAX AI Coach", "AutoCollect", "Virtuagym Connect"]);
  });

  it("maps features to their logical dashboard pages", () => {
    expect(getDashboardFeaturesForPage("coaching").map((feature) => feature.title)).toEqual([
      "Workout Plan Creator",
      "Nutrition Coaching",
      "On Demand Videos",
      "Progress Tracking",
      "Heart Rate Coaching",
      "MAX AI Coach",
    ]);
    expect(getDashboardFeaturesForPage("retention")).toHaveLength(6);
    expect(getDashboardFeaturesForPage("payments")).toHaveLength(5);
    expect(getDashboardFeaturesForPage("integrations")).toHaveLength(5);
  });
});
