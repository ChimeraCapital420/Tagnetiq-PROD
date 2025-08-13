import React from "react";
import { Link } from "react-router-dom";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

type Props = { onToggleWatermark?: () => void };

const themes = ["Executive","Matrix","Safari","DarkKnight","Cyberpunk","Ocean","Forest","Sunset"];

export default function SettingsMenu({ onToggleWatermark }: Props) {
  const { toast } = useToast();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">Account & Preferences</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast({ title: "Feedback", description: "Opening feedback form�" })}>
          Send Feedback
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Themes</DropdownMenuLabel>
        {themes.map((t) => (
          <DropdownMenuItem key={t} onClick={() => toast({ title: "Theme switched", description: `Applied: ${t}` })}>
            {t}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleWatermark}>Toggle Watermark</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="#" onClick={(e) => { e.preventDefault(); toast({ title: "Logged out" }); }}>
            Log out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}