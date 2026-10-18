// One icon set for the whole app: lucide-react. Import icons from
// "lucide-react" directly in new code.
//
// MENU_ICONS turns the icon names stored in the menu config (app/components/shell/navigation.js,
// written when the app used react-icons) into lucide icons, so the config
// didn't have to change. Unknown names fall back to a neutral dot.
import {
  ArrowDownToLine, Banknote, CalendarDays, CalendarRange, ChartColumn, Circle, HandCoins, Headset, House, Inbox,
  LayoutDashboard, ListChecks, MessagesSquare, Newspaper, NotebookPen, Receipt, Repeat, ScrollText, Settings, ShoppingCart,
  TrendingUp, Users, Wallet, Wrench,
} from "lucide-react";

export const MENU_ICONS = {
  home: House,
  MdOutlineSpaceDashboard: LayoutDashboard, // dashboards
  MdShoppingCart: ShoppingCart, // purchases
  GrTransaction: NotebookPen, // entries
  MdOutlineBarChart: ChartColumn, // reports, sales report
  MdOutlineRequestPage: Inbox, // requested panel (approvals)
  MdOutlineFactCheck: ListChecks, // my requested
  MdOutlineDynamicFeed: Newspaper, // feeds
  MdAttachMoney: HandCoins, // loans
  IoSettingsSharp: Settings,
  MdOutlineSettings: Settings,
  MdOutlineManageSearch: ScrollText, // audit log
  MdPeopleOutline: Users, // staff management
  MdOutlinePeople: Users,
  MdOutlinePayments: Banknote, // payroll
  MdOutlineCalendarMonth: CalendarDays, // attendance, advance report
  MdOutlineCalendarToday: CalendarRange, // yearly summary
  MdAppRegistration: Wrench, // tools
  MdOutlineSupportAgent: Headset, // support
  MdOutlineChat: MessagesSquare, // chat
  MdOutlineAccountBalanceWallet: Wallet, // cash tracker, deposits
  MdOutlineAttachMoney: Receipt, // cost report
  MdOutlineAttachMoney2: Receipt,
  MdOutlineMoneyOffCsred: ArrowDownToLine, // withdrawals
  MdOutlineInsights: TrendingUp,
  FcSalesPerformance: TrendingUp,
  SiRedhatopenshift: Repeat,
};

/** The lucide icon for a menu-config name. */
export const menuIcon = (name) => MENU_ICONS[name] || Circle;
