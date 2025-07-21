
"use client"

import * as React from "react"
import Link from "next/link"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { ChevronDown, PanelLeft } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3.5rem"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    
    const setOpen = React.useCallback(
        (value: boolean | ((currentOpen: boolean) => boolean)) => {
            const newOpenState = typeof value === "function" ? value(open) : value;
            if (setOpenProp) {
                setOpenProp(newOpenState);
            } else {
                _setOpen(newOpenState);
            }
            if (typeof window !== "undefined") {
                document.cookie = `${SIDEBAR_COOKIE_NAME}=${newOpenState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
            }
        },
        [open, setOpenProp]
    );
    
    React.useEffect(() => {
        if (typeof window !== "undefined") {
            const cookieValue = document.cookie
                .split("; ")
                .find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
                ?.split("=")[1];
            if (cookieValue) {
                const cookieOpenState = cookieValue === "true";
                if (openProp === undefined) { 
                    _setOpen(cookieOpenState);
                }
            }
        }
    }, [openProp]); 


    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((current) => !current)
        : setOpen((current) => !current)
    }, [isMobile, setOpen, setOpenMobile])

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div style={{ ...style }} className={cn("flex min-h-svh w-full", className)} ref={ref} {...props}>
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => {
    const { open } = useSidebar()
    const state = open ? "expanded" : "collapsed"
    
    return (
      <div data-state={state} className={cn("hidden md:flex flex-col h-svh bg-sidebar text-sidebar-foreground w-[16rem] data-[state=collapsed]:w-[3.5rem] transition-[width] duration-300 ease-in-out border-r border-sidebar-border", className)} ref={ref} {...props}>
          {children}
      </div>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<React.ElementRef<typeof Button>, React.ComponentProps<typeof Button>>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()
    return (
      <Button ref={ref} variant="ghost" size="icon" className={cn("h-8 w-8", className)} onClick={(e) => { onClick?.(e); toggleSidebar()}} {...props}>
        <PanelLeft />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    )
  }
)
SidebarTrigger.displayName = "SidebarTrigger"

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn("flex flex-col p-3", className)} {...props}/>
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarBody = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-3", className)} {...props}/>
})
SidebarBody.displayName = "SidebarBody"


const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn("flex flex-col gap-2 p-3 mt-auto", className)} {...props}/>
})
SidebarFooter.displayName = "SidebarFooter"


const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props}/>
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("group/menu-item relative", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"


const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isActive?: boolean;
    tooltip?: React.ComponentProps<typeof TooltipContent> | string;
    asChild?: boolean;
  }
>(({ isActive = false, tooltip, className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const { open } = useSidebar();

  const button = (
    <Comp
      ref={ref}
      data-active={isActive}
      className={cn(
        "w-full justify-start items-center gap-2", 
        "inline-flex whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", 
        "h-10 px-4 py-2", 
        "bg-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground", 
        !open && "px-2",
        className
      )}
      {...props}
    />
  );
  
  if (!tooltip || open) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        {...(typeof tooltip === "string" ? { children: tooltip } : tooltip)}
      >
        {typeof tooltip === "string" ? tooltip : tooltip.children}
      </TooltipContent>
    </Tooltip>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuSub = ({ label, icon, children, isActive }: { label: string; icon: React.ReactNode; children: React.ReactNode; isActive?: boolean }) => {
  const { open } = useSidebar();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setIsOpen(false);
  }, [open]);

  if (!open) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start items-center gap-2 h-10 px-2 py-2"
            data-active={isActive}
            aria-label={label}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          data-active={isActive}
          className="w-full h-10 px-4 py-2 justify-start"
        >
          {icon}
          <span className="flex-1 text-left ml-2">{label}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu className="ml-4 mt-1 border-l border-sidebar-border pl-4">
          {children}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
};
SidebarMenuSub.displayName = "SidebarMenuSub";


const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>((props, ref) => <li ref={ref} className="relative" {...props} />);
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<typeof Link> & { isActive?: boolean }
>(({ className, isActive, children, ...props }, ref) => {
  return (
    <Link
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-md p-1.5 text-sm font-normal text-sidebar-foreground/80 outline-none transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";


export {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}

