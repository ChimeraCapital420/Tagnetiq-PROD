// FILE: src/components/marketplace/ShareButton.tsx
// Social share button with multiple platforms

import { useState } from 'react';
import { Share2, Facebook, Twitter, Link2, Mail, MessageCircle, Check, X } from 'lucide-react';

interface ShareButtonProps {
  listingId: string;
  itemName: string;
  price: number;
  imageUrl?: string;
}

export function ShareButton({ listingId, itemName, price, imageUrl }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const domain = window.location.origin;
  const listingUrl = `${domain}/marketplace/${listingId}`;
  const shareText = `${itemName} - $${price.toFixed(2)} on TagnetIQ`;
  const encodedUrl = encodeURIComponent(listingUrl);
  const encodedText = encodeURIComponent(shareText);
  const hashtags = 'TagnetIQ,forsale,collectibles';

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${hashtags}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodeURIComponent(imageUrl || '')}&description=${encodedText}`,
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    email: `mailto:?subject=${encodeURIComponent(itemName)}&body=${encodedText}%0A%0A${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(itemName)}`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(listingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = listingUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: itemName,
          text: shareText,
          url: listingUrl,
        });
      } catch (err) {
        // User cancelled or error - open modal instead
        setIsOpen(true);
      }
    } else {
      setIsOpen(true);
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, '_blank', 'width=600,height=400,scrollbars=yes');
  };

  return (
    <div className="relative">
      {/* Main Share Button */}
      <button
        onClick={handleNativeShare}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
      >
        <Share2 size={18} />
        <span>Share</span>
      </button>

      {/* Share Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Share this listing</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview Card */}
            <div className="p-4 bg-zinc-800/50 m-4 rounded-xl">
              <div className="flex gap-3">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={itemName}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{itemName}</div>
                  <div className="text-emerald-400 font-bold">${price.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Share Options */}
            <div className="p-4 grid grid-cols-4 gap-4">
              <button
                onClick={() => openShareWindow(shareLinks.facebook)}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Facebook size={24} />
                </div>
                <span className="text-xs text-zinc-400">Facebook</span>
              </button>

              <button
                onClick={() => openShareWindow(shareLinks.twitter)}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-sky-500 rounded-full flex items-center justify-center">
                  <Twitter size={24} />
                </div>
                <span className="text-xs text-zinc-400">Twitter</span>
              </button>

              <button
                onClick={() => openShareWindow(shareLinks.whatsapp)}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <MessageCircle size={24} />
                </div>
                <span className="text-xs text-zinc-400">WhatsApp</span>
              </button>

              <button
                onClick={() => openShareWindow(shareLinks.pinterest)}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                  </svg>
                </div>
                <span className="text-xs text-zinc-400">Pinterest</span>
              </button>

              <button
                onClick={() => openShareWindow(shareLinks.telegram)}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-sky-400 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <span className="text-xs text-zinc-400">Telegram</span>
              </button>

              <button
                onClick={() => openShareWindow(shareLinks.reddit)}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                </div>
                <span className="text-xs text-zinc-400">Reddit</span>
              </button>

              <button
                onClick={() => window.location.href = shareLinks.email}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-zinc-600 rounded-full flex items-center justify-center">
                  <Mail size={24} />
                </div>
                <span className="text-xs text-zinc-400">Email</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  copied ? 'bg-emerald-600' : 'bg-zinc-600'
                }`}>
                  {copied ? <Check size={24} /> : <Link2 size={24} />}
                </div>
                <span className="text-xs text-zinc-400">
                  {copied ? 'Copied!' : 'Copy Link'}
                </span>
              </button>
            </div>

            {/* Embed Code Section */}
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={() => {
                  const embedCode = `<iframe src="${listingUrl}/embed" width="400" height="300" frameborder="0"></iframe>`;
                  navigator.clipboard.writeText(embedCode);
                }}
                className="w-full text-sm text-zinc-400 hover:text-white transition-colors text-center"
              >
                📋 Copy Embed Code for Forums/Blogs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}