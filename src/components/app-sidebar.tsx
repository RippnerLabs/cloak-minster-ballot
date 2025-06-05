"use client"

import * as React from "react"
import {
  Home,
  Vote,
  UserPlus,
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  FileText,
  Receipt,
  Plus,
  ToggleLeft,
  Download,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// ZK Voting System navigation data
const data = {
  user: {
    name: "Voter",
    email: "voter@example.com",
    avatar: "/avatars/voter.jpg",
  },
  teams: [
    {
      name: "ZK Voting System",
      logo: Vote,
      plan: "Solana",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      items: [
        {
          title: "Overview",
          url: "/dashboard",
        },
        {
          title: "Create Election",
          url: "/dashboard/new",
        },
        {
          title: "Manage Phases",
          url: "/dashboard/phase",
        },
        {
          title: "Voters",
          url: "/dashboard/voters",
        },
        {
          title: "Results",
          url: "/dashboard/results",
        },
      ],
    },
    {
      title: "Elections",
      url: "/",
      icon: Home,
      isActive: true,
      items: [
        {
          title: "Current Election",
          url: "/",
        },
        {
          title: "Register to Vote",
          url: "/register",
        },
        {
          title: "Cast Vote",
          url: "/vote",
        },
      ],
    },
    {
      title: "Voting",
      url: "/vote",
      icon: Vote,
      items: [
        {
          title: "Register",
          url: "/register",
        },
        {
          title: "Download Voucher",
          url: "/voucher",
        },
        {
          title: "Cast Vote",
          url: "/vote",
        },
        {
          title: "View Receipt",
          url: "/receipt",
        },
      ],
    },
    {
      title: "Documentation",
      url: "/docs",
      icon: FileText,
      items: [
        {
          title: "How to Vote",
          url: "/docs",
        },
        {
          title: "ZK Proofs",
          url: "/docs",
        },
        {
          title: "Privacy",
          url: "/docs",
        },
        {
          title: "FAQ",
          url: "/docs",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Admin Tools",
      url: "/dashboard",
      icon: Settings,
    },
    {
      name: "Voter Management",
      url: "/dashboard/voters",
      icon: Users,
    },
    {
      name: "Election Results",
      url: "/dashboard/results",
      icon: BarChart3,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
