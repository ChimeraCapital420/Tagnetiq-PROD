// FILE: src/features/boardroom/components/Header.tsx
// Boardroom Header Component

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  Settings, 
  Bell, 
  Search,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
  notificationCount?: number;
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
  className?: string;
}

export function Header({
  title = 'Executive Boardroom',
  subtitle,
  showBack = false,
  showSearch = false,
  showNotifications = true,
  notificationCount = 0,
  onMenuClick,
  isMobileMenuOpen = false,
  className,
}: HeaderProps) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleBack = () => {
    navigate(-1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
      console.log('Search:', searchQuery);
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/75',
        className
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Toggle */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-400 hover:text-white"
              onClick={onMenuClick}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* Back Button */}
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Title */}
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch && (
            <>
              {searchOpen ? (
                <form onSubmit={handleSearch} className="relative">
                  <Input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 sm:w-64 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    autoFocus
                    onBlur={() => {
                      if (!searchQuery) setSearchOpen(false);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  className="text-slate-400 hover:text-white"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
            </>
          )}

          {/* Notifications */}
          {showNotifications && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-slate-400 hover:text-white"
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-slate-800 border-slate-700">
                <DropdownMenuLabel className="text-white">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                {notificationCount === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    No new notifications
                  </div>
                ) : (
                  <>
                    <DropdownMenuItem className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">Griffin completed analysis</span>
                        <span className="text-xs text-slate-400">2 minutes ago</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">Athena has strategic insights</span>
                        <span className="text-xs text-slate-400">15 minutes ago</span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Settings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
              <DropdownMenuLabel className="text-white">Settings</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
                Voice Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
                Notification Preferences
              </DropdownMenuItem>
              <DropdownMenuItem className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
                Board Member Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
                Meeting History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default Header;