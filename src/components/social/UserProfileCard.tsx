// FILE: src/components/social/UserProfileCard.tsx
// Clickable user card for use throughout the app

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfileCardProps {
  user: {
    id: string;
    screen_name: string;
    avatar_url?: string | null;
  };
  showFriendBadge?: boolean;
  isFriend?: boolean;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
  className?: string;
  subtitle?: string;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  showFriendBadge = false,
  isFriend = false,
  size = 'md',
  clickable = true,
  className,
  subtitle,
}) => {
  const navigate = useNavigate();

  const sizeClasses = {
    sm: { avatar: 'h-8 w-8', text: 'text-sm', initials: 'text-xs' },
    md: { avatar: 'h-10 w-10', text: 'text-base', initials: 'text-sm' },
    lg: { avatar: 'h-12 w-12', text: 'text-lg', initials: 'text-base' },
  };

  const initials = user.screen_name?.slice(0, 2).toUpperCase() || '??';

  const handleClick = () => {
    if (clickable) {
      navigate(`/user/${user.id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center gap-3',
        clickable && 'cursor-pointer hover:bg-zinc-800/50 rounded-lg transition-colors p-2 -m-2',
        className
      )}
    >
      <Avatar className={cn(sizeClasses[size].avatar, 'border border-zinc-700')}>
        <AvatarImage src={user.avatar_url || undefined} />
        <AvatarFallback className={cn('bg-zinc-800 text-zinc-400', sizeClasses[size].initials)}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium text-white truncate', sizeClasses[size].text)}>
            {user.screen_name}
          </span>
          {showFriendBadge && isFriend && (
            <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px] h-5">
              <Users className="h-3 w-3 mr-1" />
              Friend
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-zinc-500 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default UserProfileCard;