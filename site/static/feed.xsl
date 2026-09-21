<?xml version="1.0" encoding="utf-8"?>
<!-- Renders the RSS feed as a readable page when opened in a browser. Feed readers ignore it. -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="utf-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> · feed</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400&amp;display=swap" rel="stylesheet"/>
        <style>
          :root { color-scheme: light dark; --surface:#F3F4F8; --ink:#0B0E1C; --ink-2:#3A4059; --mist:#666C85; --line:rgba(11,14,28,.10); --cobalt:#2B4DFF; --code-bg:rgba(11,14,28,.06); }
          @media (prefers-color-scheme: dark) { :root { --surface:#201B34; --ink:#EDEBF8; --ink-2:#C6C1DC; --mist:#9C96BE; --line:rgba(233,231,246,.15); --cobalt:#8FA2FF; --code-bg:rgba(233,231,246,.12); } }
          * { box-sizing:border-box; margin:0; padding:0; }
          body { font-family:"Geist",-apple-system,"Helvetica Neue",Arial,sans-serif; font-size:17px; line-height:1.6; color:var(--ink); background:var(--surface); padding:96px clamp(20px,4vw,48px); }
          main { max-width:720px; margin:0 auto; }
          h1 { font-size:2rem; letter-spacing:-.02em; font-weight:600; line-height:1.15; }
          .lede { color:var(--ink-2); margin-top:12px; }
          .note { margin:24px 0 40px; padding:12px 16px; border-left:3px solid var(--cobalt); background:var(--code-bg); font-size:.95rem; color:var(--ink-2); }
          code { font-family:"Geist Mono",ui-monospace,Menlo,monospace; font-size:.88em; background:var(--code-bg); padding:.1em .35em; border-radius:4px; }
          ol { list-style:none; display:flex; flex-direction:column; gap:32px; }
          time { display:block; font-family:"Geist Mono",ui-monospace,Menlo,monospace; font-size:.82rem; color:var(--mist); margin-bottom:8px; }
          h2 { font-size:1.35rem; letter-spacing:-.01em; font-weight:600; line-height:1.25; }
          a { color:inherit; text-decoration:none; }
          h2 a:hover { color:var(--cobalt); }
          p { color:var(--ink-2); margin-top:6px; }
          .tag { display:inline-block; font-family:"Geist Mono",ui-monospace,Menlo,monospace; font-size:.78rem; padding:2px 10px; border:1px solid var(--line); border-radius:999px; color:var(--ink-2); margin:12px 6px 0 0; }
          footer { margin-top:56px; padding-top:24px; border-top:1px solid var(--line); color:var(--mist); font-size:.9rem; }
        </style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="lede"><xsl:value-of select="/rss/channel/description"/></p>
          <div class="note">
            This is the blog's RSS feed. Copy this page's address into your feed reader to follow new posts:
            <code><xsl:value-of select="/rss/channel/atom:link/@href"/></code>
          </div>
          <ol>
            <xsl:for-each select="/rss/channel/item">
              <li>
                <time><xsl:value-of select="substring(pubDate, 1, 16)"/></time>
                <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
                <p><xsl:value-of select="description"/></p>
                <xsl:for-each select="category"><span class="tag"><xsl:value-of select="."/></span></xsl:for-each>
              </li>
            </xsl:for-each>
          </ol>
          <footer><a href="{/rss/channel/link}">Back to the blog</a></footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
