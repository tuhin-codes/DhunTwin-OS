import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  User,
  X,
  AlertTriangle,
  Wrench,
  Sparkles,
  Check,
} from "lucide-react";

import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
}

interface Notification {
  id: number;
  type: "critical" | "maintenance" | "ai";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const pageInfo: Record<
  string,
  {
    title: string;
    subtitle: string;
  }
> = {
  "/": {
    title: "Factory Overview",
    subtitle: "Live factory intelligence",
  },

  "/digital-twins": {
    title: "Digital Twins",
    subtitle: "Live asset intelligence",
  },

  "/ai-control-center": {
    title: "AI Control Center",
    subtitle: "Optimization and decision intelligence",
  },

  "/maintenance": {
    title: "Maintenance",
    subtitle: "Predictive maintenance intelligence",
  },

  "/sustainability": {
    title: "Sustainability",
    subtitle: "Energy and carbon intelligence",
  },

  "/reports": {
    title: "Reports",
    subtitle: "Operational and sustainability reports",
  },

  "/ai-copilot": {
    title: "AI Copilot",
    subtitle: "CarbonTwin intelligence assistant",
  },

  "/settings": {
    title: "Settings",
    subtitle: "System configuration",
  },
};

const initialNotifications: Notification[] = [
  {
    id: 1,
    type: "critical",
    title: "Machine attention required",
    message:
      "Production Motor 1 is showing elevated operational risk.",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    type: "maintenance",
    title: "Maintenance attention",
    message:
      "Cooling Pump 2 requires maintenance review.",
    time: "12 min ago",
    read: false,
  },
  {
    id: 3,
    type: "ai",
    title: "Optimization opportunity",
    message:
      "AI identified a potential energy and carbon reduction opportunity.",
    time: "21 min ago",
    read: false,
  },
];

export default function Topbar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileSidebar,
}: TopbarProps) {
  const location = useLocation();

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);

  const notificationRef =
    useRef<HTMLDivElement>(null);

  const current =
    pageInfo[location.pathname] ??
    pageInfo["/"];

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  // ------------------------------------------------------------
  // CLOSE NOTIFICATION PANEL WHEN CLICKING OUTSIDE
  // ------------------------------------------------------------

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(
          event.target as Node,
        )
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  // ------------------------------------------------------------
  // MARK ONE NOTIFICATION AS READ
  // ------------------------------------------------------------

  const markAsRead = (id: number) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read: true,
            }
          : notification,
      ),
    );
  };

  // ------------------------------------------------------------
  // MARK ALL AS READ
  // ------------------------------------------------------------

  const markAllAsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      })),
    );
  };

  // ------------------------------------------------------------
  // NOTIFICATION ICON
  // ------------------------------------------------------------

  const notificationIcon = (
    type: Notification["type"],
  ) => {
    if (type === "critical") {
      return (
        <div
          className="
            flex h-8 w-8 shrink-0
            items-center justify-center
            rounded-[9px]
            bg-[#FEF2F2]
            text-[#DC2626]
          "
        >
          <AlertTriangle
            size={15}
            strokeWidth={1.9}
          />
        </div>
      );
    }

    if (type === "maintenance") {
      return (
        <div
          className="
            flex h-8 w-8 shrink-0
            items-center justify-center
            rounded-[9px]
            bg-[#FFF7ED]
            text-[#EA580C]
          "
        >
          <Wrench
            size={15}
            strokeWidth={1.9}
          />
        </div>
      );
    }

    return (
      <div
        className="
          flex h-8 w-8 shrink-0
          items-center justify-center
          rounded-[9px]
          bg-[#F0FDF4]
          text-[#16A34A]
        "
      >
        <Sparkles
          size={15}
          strokeWidth={1.9}
        />
      </div>
    );
  };

  return (
    <header
      className="
        sticky top-0 z-30
        flex h-[64px] shrink-0
        items-center
        border-b border-[#DDE7E1]
        bg-white/95
        px-4
        backdrop-blur
        sm:px-6
        lg:px-7
      "
    >
      {/* LEFT */}

      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="
            hidden h-8 w-8
            items-center justify-center
            rounded-[9px]
            text-[#64736A]
            transition
            hover:bg-[#F1F6F3]
            hover:text-[#15211B]
            lg:flex
          "
          aria-label={
            sidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          <Menu size={18} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="
            flex h-8 w-8
            items-center justify-center
            rounded-[9px]
            text-[#64736A]
            transition
            hover:bg-[#F1F6F3]
            lg:hidden
          "
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

            <p className="truncate text-[14px] font-bold tracking-[-0.01em] text-[#15211B]">
              {current.title}
            </p>
          </div>

          <p className="mt-0.5 hidden truncate pl-3.5 text-[10px] text-[#7A8981] sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* RIGHT */}

      <div className="ml-auto flex items-center gap-2">
        {/* SEARCH */}

        <div
          className="
            hidden h-[36px]
            items-center
            rounded-[10px]
            border border-[#DDE7E1]
            bg-[#F8FAF9]
            md:flex
          "
        >
          <Search
            size={14}
            className="ml-3 text-[#98A49E]"
          />

          <input
            type="search"
            placeholder="Search assets, metrics, alerts..."
            className="
              w-[205px]
              bg-transparent
              px-2.5
              text-[11px]
              text-[#15211B]
              outline-none
              placeholder:text-[#9AA69F]
              lg:w-[235px]
            "
          />
        </div>

        {/* CONNECTED */}

        <div
          className="
            hidden h-[32px]
            items-center gap-1.5
            rounded-[8px]
            border border-[#BFE8D1]
            bg-[#F0FBF4]
            px-2.5
            sm:flex
          "
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
          </span>

          <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#087443]">
            Connected
          </span>
        </div>

        {/* ================================================== */}
        {/* NOTIFICATIONS */}
        {/* ================================================== */}

        <div
          ref={notificationRef}
          className="relative"
        >
          <button
            type="button"
            onClick={() =>
              setNotificationsOpen(
                (open) => !open,
              )
            }
            className="
              relative
              flex h-[36px] w-[36px]
              items-center justify-center
              rounded-[10px]
              text-[#64736A]
              transition
              hover:bg-[#F1F6F3]
              hover:text-[#15211B]
            "
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell
              size={17}
              strokeWidth={1.8}
            />

            {unreadCount > 0 && (
              <span
                className="
                  absolute right-[4px] top-[3px]
                  flex h-[14px] w-[14px]
                  items-center justify-center
                  rounded-full
                  bg-[#EF4444]
                  text-[7px]
                  font-bold
                  text-white
                  ring-2 ring-white
                "
              >
                {unreadCount > 9
                  ? "9+"
                  : unreadCount}
              </span>
            )}
          </button>

          {/* NOTIFICATION PANEL */}

          {notificationsOpen && (
            <div
              className="
                absolute right-0 top-[46px]
                z-50
                w-[350px]
                overflow-hidden
                rounded-[14px]
                border border-[#DDE7E1]
                bg-white
                shadow-[0_16px_40px_rgba(21,33,27,0.12)]
              "
            >
              {/* HEADER */}

              <div
                className="
                  flex items-center justify-between
                  border-b border-[#E7EEE9]
                  px-4 py-3
                "
              >
                <div>
                  <p className="text-[12px] font-bold text-[#15211B]">
                    Notifications
                  </p>

                  <p className="mt-0.5 text-[9px] text-[#7A8981]">
                    {unreadCount > 0
                      ? `${unreadCount} unread notification${
                          unreadCount === 1
                            ? ""
                            : "s"
                        }`
                      : "All notifications read"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setNotificationsOpen(false)
                  }
                  className="
                    flex h-7 w-7
                    items-center justify-center
                    rounded-[8px]
                    text-[#8A9891]
                    transition
                    hover:bg-[#F1F6F3]
                    hover:text-[#15211B]
                  "
                  aria-label="Close notifications"
                >
                  <X size={14} />
                </button>
              </div>

              {/* ACTION */}

              {unreadCount > 0 && (
                <div
                  className="
                    flex justify-end
                    border-b border-[#EEF3F0]
                    px-4 py-2
                  "
                >
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="
                      flex items-center gap-1
                      text-[9px]
                      font-bold
                      text-[#087443]
                      transition
                      hover:text-[#065C35]
                    "
                  >
                    <Check size={12} />
                    Mark all as read
                  </button>
                </div>
              )}

              {/* NOTIFICATIONS */}

              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div
                    className="
                      px-5 py-10
                      text-center
                    "
                  >
                    <Bell
                      size={22}
                      className="
                        mx-auto
                        text-[#A8B3AD]
                      "
                    />

                    <p className="mt-2 text-[11px] font-bold text-[#15211B]">
                      No notifications
                    </p>

                    <p className="mt-1 text-[9px] text-[#7A8981]">
                      You're all caught up.
                    </p>
                  </div>
                ) : (
                  notifications.map(
                    (notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() =>
                          markAsRead(
                            notification.id,
                          )
                        }
                        className={`
                          flex w-full
                          gap-3
                          border-b border-[#EEF3F0]
                          px-4 py-3
                          text-left
                          transition
                          hover:bg-[#F8FAF9]
                          ${
                            notification.read
                              ? "bg-white"
                              : "bg-[#FAFCFB]"
                          }
                        `}
                      >
                        {notificationIcon(
                          notification.type,
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`
                                text-[10px]
                                font-bold
                                ${
                                  notification.read
                                    ? "text-[#526159]"
                                    : "text-[#15211B]"
                                }
                              `}
                            >
                              {notification.title}
                            </p>

                            {!notification.read && (
                              <span
                                className="
                                  mt-1
                                  h-1.5 w-1.5
                                  shrink-0
                                  rounded-full
                                  bg-[#16A34A]
                                "
                              />
                            )}
                          </div>

                          <p className="mt-1 text-[9px] leading-[1.4] text-[#7A8981]">
                            {notification.message}
                          </p>

                          <p className="mt-1.5 text-[8px] font-medium text-[#A0ABA5]">
                            {notification.time}
                          </p>
                        </div>
                      </button>
                    ),
                  )
                )}
              </div>

              {/* FOOTER */}

              <div
                className="
                  border-t border-[#E7EEE9]
                  bg-[#FAFCFB]
                  px-4 py-2.5
                  text-center
                "
              >
                <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#8A9891]">
                  CarbonTwin OS • Live Intelligence
                </span>
              </div>
            </div>
          )}
        </div>

        {/* OPERATOR */}

        <button
          type="button"
          className="
            hidden
            items-center gap-2
            rounded-[10px]
            px-1.5 py-1
            text-left
            transition
            hover:bg-[#F1F6F3]
            sm:flex
          "
        >
          <div
            className="
              flex h-8 w-8
              items-center justify-center
              rounded-full
              bg-gradient-to-br
              from-[#16A34A]
              to-[#087443]
            "
          >
            <User
              size={14}
              strokeWidth={1.8}
              className="text-white"
            />
          </div>

          <div className="hidden lg:block">
            <p className="text-[11px] font-bold leading-tight text-[#15211B]">
              Operator
            </p>

            <p className="mt-0.5 text-[9px] text-[#7A8981]">
              Administrator
            </p>
          </div>

          <ChevronDown
            size={13}
            className="text-[#9AA69F]"
          />
        </button>
      </div>
    </header>
  );
}