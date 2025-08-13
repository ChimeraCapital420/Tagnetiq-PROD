import React, { useState } from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useToast } from "./ui/use-toast";
import { Settings } from "lucide-react";

type Props = {
  isAdmin?: boolean;
  onThemePick?: (theme: string) => void;
  onFeedback?: () => void;
  onLogout?: () => void;
};

const THEMES = [
  "Executive","Matrix","Safari","DarkKnight","Cyberpunk","Ocean","Forest","Sunset",
];

export default function SettingsCog({
  isAdmin = false,
  onThemePick,
  onFeedback,
  onLogout,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const pickTheme = (t: string) => {
    onThemePick?.(t);
    toast({ title: "Theme applied", description: `${t} theme active.` });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="rounded-full">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs opacity-70">
          Themes
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-2 px-2 pb-2">
          {THEMES.map((t) => (
            <Button
              key={t}
              variant="secondary"
              className="justify-start"
              onClick={() => pickTheme(t)}
            >
              {t}
            </Button>
          ))}
        </div>

        <DropdownMenuItem onClick={onFeedback}>Send Feedback</DropdownMenuItem>

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs opacity-70">
              Admin
            </DropdownMenuLabel>
            <a href="/admin/beta" className="block">
              <DropdownMenuItem>Beta Controls</DropdownMenuItem>
            </a>
            <a href="/admin/investors" className="block">
              <DropdownMenuItem>Investor Suite</DropdownMenuItem>
            </a>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
