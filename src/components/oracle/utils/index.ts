// FILE: src/components/oracle/utils/index.ts
// Text formatting helpers for Oracle messages

import React from 'react';

/**
 * Render message content with line breaks and bold (**text**) support
 */
export function formatMessageContent(content: string): React.ReactNode {
  return content.split('\n').map((line, j) =>
    React.createElement(React.Fragment, { key: j },
      j > 0 ? React.createElement('br') : null,
      ...line.split(/\*\*(.*?)\*\*/g).map((part, k) =>
        k % 2 === 1
          ? React.createElement('strong', { key: k, className: 'font-semibold' }, part)
          : React.createElement('span', { key: k }, part)
      )
    )
  );
}