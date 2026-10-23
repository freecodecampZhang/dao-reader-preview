/* ===== 道藏在线阅读 脚本 ===== */
(function () {
  'use strict';

  // ---------- 状态 ----------
  const state = {
    books: [],          // 书库书籍
    uploaded: new Map(), // 上传的书籍 id -> {id, name, content}
    currentBook: null,   // 当前阅读书籍 {id, name, content, chapters, pages, pageIndex}
    pageSize: 3000,      // 每页字符数
    fontSize: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--font-size')) || 18,
    theme: localStorage.getItem('dao_theme') || '',
  };

  // ---------- DOM 引用 ----------
  const $ = (id) => document.getElementById(id);
  const views = {
    library: $('view-library'),
    shelf: $('view-shelf'),
    history: $('view-history'),
    upload: $('view-upload'),
    reader: $('view-reader'),
  };

  // 记录非阅读视图，供返回按钮使用
  let lastView = 'library';
  let controlsHideTimer = 0;
  let longPressTimer = 0;
  let longPressTriggered = false;
  let suppressReaderClick = false;

  // ---------- 视图切换 ----------
  function switchView(name) {
    if (name !== 'reader') {
      lastView = name;
      setReaderImmersive(false);
    }
    Object.keys(views).forEach((k) => views[k].classList.toggle('active', k === name));
    document.querySelectorAll('.nav-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.view === name)
    );
  }

  function setReaderImmersive(enabled) {
    views.reader.classList.toggle('immersive', enabled);
    document.body.classList.toggle('reader-immersive', enabled);
    window.clearTimeout(controlsHideTimer);
    window.clearTimeout(longPressTimer);
    controlsHideTimer = 0;
    longPressTimer = 0;
    longPressTriggered = false;
    suppressReaderClick = false;
    if (enabled) setControlsVisible(false);
    else setControlsVisible(true);
    if (enabled) {
      $('tocPanel').classList.remove('open');
      $('searchOverlay').classList.add('hidden');
    }
    const button = $('immersiveBtn');
    if (button) {
      button.textContent = enabled ? '⤢' : '⛶';
      button.title = enabled ? '退出全屏' : '全屏阅读';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(enabled));
    }
    requestAnimationFrame(reflowCurrentBook);
  }

  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.addEventListener('click', () => {
      switchView(b.dataset.view);
      if (b.dataset.view === 'library') {
        renderLibrary();
        renderContinueCard();
      }
      if (b.dataset.view === 'shelf') renderShelf();
      if (b.dataset.view === 'history') renderHistory();
    });
  });
  $('refreshLibraryBtn').addEventListener('click', loadLibrary);
  $('brand').addEventListener('click', () => {
    switchView('library');
    renderLibrary();
    renderContinueCard();
  });

  $('continueBtn').addEventListener('click', () => {
    const latest = loadHistory()[0];
    if (latest) openHistoryItem(latest);
  });

  $('clearHistoryBtn').addEventListener('click', () => {
    if (!window.confirm('确定清空全部阅读历史吗？')) return;
    try { localStorage.removeItem('dao_history'); } catch {}
    renderHistory();
    renderContinueCard();
  });

  $('favBtn').addEventListener('click', () => {
    const book = state.currentBook;
    if (!book) return;
    toggleFavoriteById(book.id, book.name, book.path);
    updateFavBtn();
    if (views.shelf.classList.contains('active')) renderShelf();
  });

  $('immersiveBtn').addEventListener('click', () => {
    setReaderImmersive(!views.reader.classList.contains('immersive'));
  });

  // ---------- 书库加载 ----------
  async function loadLibrary() {
    try {
      const res = await fetch('/api/books');
      const data = await res.json();
      state.books = data;
      renderLibrary();
      renderContinueCard();
      $('bookCount').textContent = `共 ${data.total} 本`;
    } catch (e) {
      $('libraryContent').innerHTML = '<div class="loading">加载失败，请刷新重试</div>';
    }
  }

  function renderLibrary() {
    const filter = $('searchInput').value.trim().toLowerCase();
    const groups = state.books.groups || {};
    const history = loadHistory();
    const container = $('libraryContent');
    container.innerHTML = '';

    let totalShown = 0;
    Object.keys(groups)
      .sort()
      .forEach((dir) => {
        const books = groups[dir].filter((b) =>
          !filter || b.name.toLowerCase().includes(filter)
        );
        if (books.length === 0) return;
        totalShown += books.length;

        const group = document.createElement('div');
        group.className = 'group';
        const title = document.createElement('div');
        title.className = 'group-title';
        title.textContent = `${dir} (${books.length})`;
        group.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'book-grid';
        books.forEach((b) => {
          grid.appendChild(createBookCard({ ...b, id: 'server:' + b.path }, history));
        });
        group.appendChild(grid);
        container.appendChild(group);
      });

    if (totalShown === 0) {
      container.innerHTML = '<div class="empty">没有找到匹配的书籍</div>';
    }
  }

  $('searchInput').addEventListener('input', renderLibrary);

  // ---------- 打开服务器书籍 ----------
  async function openServerBook(book, position) {
    switchView('reader');
    $('readerTitle').textContent = book.name;
    $('readerContent').innerHTML = '<div class="loading">加载中…</div>';
    try {
      const res = await fetch(`/api/book?path=${encodeURIComponent(book.path)}`);
      if (!res.ok) throw new Error('无法读取这本书');
      const data = await res.json();
      openBook({
        id: 'server:' + book.path,
        name: book.name,
        path: book.path,
        content: data.content,
      }, position);
    } catch (e) {
      $('readerContent').innerHTML = '<div class="empty">这本书暂时无法打开，请确认文件仍在书库中。</div>';
    }
  }

  async function openUploadedBook(id, position) {
    switchView('reader');
    $('readerContent').innerHTML = '<div class="loading">加载中…</div>';
    let book = state.uploaded.get(id);
    if (!book) {
      try { book = await getUploadedBook(id); } catch {}
    }
    if (!book) {
      $('readerContent').innerHTML = '<div class="empty">找不到上传文件，请重新上传后阅读。</div>';
      return;
    }
    state.uploaded.set(id, book);
    openBook(book, position);
  }

  async function openHistoryItem(entry) {
    if (entry.path) {
      const book = findServerBook(entry.path) || { id: entry.id, name: entry.name, path: entry.path };
      await openServerBook(book, entry);
    } else {
      await openUploadedBook(entry.id, entry);
    }
  }

  // ---------- 上传功能 ----------
  const dropZone = $('dropZone');
  const fileInput = $('fileInput');
  const folderInput = $('folderInput');

  $('pickFileBtn').addEventListener('click', () => fileInput.click());
  $('pickFolderBtn').addEventListener('click', () => folderInput.click());
  fileInput.addEventListener('change', async (e) => {
    await handleFiles(e.target.files);
    e.target.value = '';
  });
  folderInput.addEventListener('change', async (e) => {
    await handleFiles(e.target.files);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    })
  );
  dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

  async function handleFiles(files) {
    const list = $('uploadList');
    let imported = 0;
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.txt')) continue;
      imported++;
      const relativePath = file.webkitRelativePath || file.name;
      const folderPath = relativePath.split('/').slice(0, -1).join('/');
      const item = document.createElement('div');
      item.className = 'upload-item';
      item.innerHTML = `
        <div>
          <div class="name">${escapeHtml(file.name)}</div>
          <div class="meta" style="color:var(--text-soft);font-size:12px">${formatSize(file.size)}${folderPath ? ` · ${escapeHtml(folderPath)}` : ''}</div>
        </div>
        <div class="actions">
          <button class="btn primary open-btn">打开阅读</button>
        </div>
      `;
      list.appendChild(item);

      const buf = await file.arrayBuffer();
      const content = decodeBuffer(new Uint8Array(buf));
      const id = 'upload:' + relativePath + ':' + file.size + ':' + file.lastModified;
      const uploadedBook = {
        id,
        name: file.name.replace(/\.txt$/i, ''),
        folderPath,
        content,
        size: file.size,
      };
      state.uploaded.set(id, uploadedBook);
      const persisted = saveUploadedBook(uploadedBook).catch(() => {});
      item.querySelector('.open-btn').addEventListener('click', () => {
        openUploadedBook(id);
      });
      await persisted;
    }
    if (!imported && files.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '所选内容中没有找到 TXT 文件';
      list.appendChild(empty);
    }
  }

  // 编码检测
  function decodeBuffer(buf) {
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(buf.subarray(2));
    }
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(buf.subarray(2));
    }
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(buf.subarray(3));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      try {
        return new TextDecoder('gbk').decode(buf);
      } catch {
        return new TextDecoder('utf-8').decode(buf);
      }
    }
  }

  // ---------- 章节解析 ----------
  // 匹配：第X章/回/卷/节/集/篇，卷X/卷之X，Chapter X 等
  const CHAPTER_RE = /^\s*(第[一二三四五六七八九十百千万零〇0-9]+[章节回卷集部篇]|卷[一二三四五六七八九十百千万零〇0-9之]+|Chapter\s+\d+|[上下中]卷|序章|楔子|引子|后记|番外)\s*[、:：.\s]?(.*)$/;

  function parseChapters(text) {
    const lines = text.split(/\r?\n/);
    const chapters = [];
    let cur = { title: '正文', lines: [] };
    let hasChapter = false;

    for (const line of lines) {
      const m = line.match(CHAPTER_RE);
      if (m && line.length < 60) {
        hasChapter = true;
        if (cur.lines.length) chapters.push(cur);
        const title = (m[1] + (m[2] ? ' ' + m[2] : '')).trim();
        cur = { title, lines: [] };
      } else {
        cur.lines.push(line);
      }
    }
    if (cur.lines.length || !hasChapter) chapters.push(cur);

    return chapters.map((c) => ({ title: c.title, content: c.lines.join('\n') }));
  }

  // ---------- 分页 ----------
  function getReaderPageSize() {
    const content = $('readerContent');
    const rect = content.getBoundingClientRect();
    const style = getComputedStyle(content);
    const fontSize = parseFloat(style.fontSize) || state.fontSize;
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 2;
    const horizontalPadding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const verticalPadding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availableWidth = Math.max(fontSize * 6, rect.width - horizontalPadding);
    const availableHeight = Math.max(lineHeight * 4, rect.height - verticalPadding);
    const columns = Math.max(6, Math.floor(availableWidth / (fontSize * 1.08)));
    const rows = Math.max(4, Math.floor(availableHeight / lineHeight));

    // 为章节标题、段落间距和字形差异留出空间，避免正文被裁出屏幕。
    return Math.max(80, Math.min(3000, Math.floor(columns * rows * 0.46)));
  }

  function paginate(chapters, pageSize) {
    const pages = [];
    for (const ch of chapters) {
      const text = ch.content;
      const paragraphs = [];
      const lines = text.split(/\r?\n/);
      let sourceOffset = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const leading = line.length - line.trimStart().length;
          paragraphs.push({ text: trimmed, offset: sourceOffset + leading });
        }
        sourceOffset += line.length;
        if (text.slice(sourceOffset, sourceOffset + 2) === '\r\n') sourceOffset += 2;
        else if (text[sourceOffset] === '\n') sourceOffset += 1;
      }

      let contentParts = [];
      let used = 0;
      let firstPage = true;
      let pageOffset = 0;
      const flush = () => {
        if (!contentParts.length) return;
        pages.push({
          chapter: ch.title,
          content: contentParts.join('\n\n'),
          isChapterStart: firstPage,
          startOffset: pageOffset,
        });
        contentParts = [];
        used = 0;
        firstPage = false;
      };

      for (const paragraph of paragraphs) {
        let offsetInParagraph = 0;
        while (offsetInParagraph < paragraph.text.length) {
          let end = Math.min(paragraph.text.length, offsetInParagraph + pageSize);
          if (end < paragraph.text.length) {
            const preferredStart = offsetInParagraph + Math.floor((end - offsetInParagraph) * 0.72);
            const breakAt = paragraph.text.slice(preferredStart, end).search(/[。！？；，、\s]/);
            if (breakAt >= 0) end = preferredStart + breakAt + 1;
          }
          const part = paragraph.text.slice(offsetInParagraph, end);
          const separatorLength = contentParts.length ? 2 : 0;
          if (contentParts.length && used + separatorLength + part.length > pageSize) flush();
          if (!contentParts.length) pageOffset = paragraph.offset + offsetInParagraph;
          contentParts.push(part);
          used += (contentParts.length > 1 ? 2 : 0) + part.length;
          offsetInParagraph = end;
          if (offsetInParagraph < paragraph.text.length) flush();
        }
      }
      flush();
      if (!paragraphs.length) {
        pages.push({ chapter: ch.title, content: '', isChapterStart: true, startOffset: 0 });
      }
    }
    return pages;
  }

  // ---------- 打开书籍并阅读 ----------
  function findPageForPosition(pages, position) {
    if (position && position.chapter) {
      const chapterPages = pages
        .map((page, index) => ({ page, index }))
        .filter(({ page }) => page.chapter === position.chapter);
      if (chapterPages.length) {
        if (Number.isFinite(position.chapterOffset)) {
          const match = chapterPages.filter(({ page }) => (page.startOffset || 0) <= position.chapterOffset).pop();
          return match ? match.index : chapterPages[0].index;
        }
        // 兼容此前只记录章节和页码的阅读历史。
        const oldPageCount = Math.max(1, Number(position.pageCount) || 1);
        const targetIndex = Math.round(((Number(position.pageIndex) || 0) / oldPageCount) * Math.max(0, pages.length - 1));
        return chapterPages.reduce((closest, item) =>
          Math.abs(item.index - targetIndex) < Math.abs(closest.index - targetIndex) ? item : closest
        ).index;
      }
    }
    if (Number.isInteger(position)) return position;
    return 0;
  }

  function openBook(book, requestedPosition) {
    const chapters = parseChapters(book.content);
    state.pageSize = getReaderPageSize();
    const pages = paginate(chapters, state.pageSize);
    state.currentBook = {
      id: book.id,
      name: book.name,
      path: book.path || '',
      content: book.content,
      chapters,
      pages,
      pageIndex: 0,
    };
    $('readerTitle').textContent = book.name;
    renderToc();
    updateFavBtn();
    const previous = requestedPosition && typeof requestedPosition === 'object'
      ? requestedPosition
      : loadHistory().find((entry) => entry.id === book.id);
    const saved = previous
      ? findPageForPosition(pages, previous)
      : (Number.isInteger(requestedPosition) ? requestedPosition : loadProgress(book.id));
    state.currentBook.pageIndex = Math.max(0, Math.min(saved, pages.length - 1));
    $('pageSlider').max = pages.length;
    renderPage();
  }

  function reflowCurrentBook() {
    const book = state.currentBook;
    const content = $('readerContent');
    if (!book || !views.reader.classList.contains('active')) return;
    const rect = content.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const currentPage = book.pages[book.pageIndex];
    const anchor = currentPage
      ? { chapter: currentPage.chapter, chapterOffset: currentPage.startOffset || 0 }
      : null;
    const nextSize = getReaderPageSize();
    if (nextSize === state.pageSize) return;
    state.pageSize = nextSize;
    book.pages = paginate(book.chapters, nextSize);
    book.pageIndex = Math.max(0, Math.min(findPageForPosition(book.pages, anchor), book.pages.length - 1));
    renderToc();
    $('pageSlider').max = book.pages.length;
    renderPage();
  }

  function renderPage(direction = '') {
    const book = state.currentBook;
    if (!book) return;
    const page = book.pages[book.pageIndex];
    if (!page) return;

    const html = renderPageContent(page, book.pageIndex);
    const content = $('readerContent');
    const previousPage = content.querySelector('.reader-page');
    const pageElement = document.createElement('div');
    pageElement.className = 'reader-page';
    pageElement.innerHTML = html;

    content.classList.remove('page-turning');
    content.replaceChildren(pageElement);
    if (previousPage && (direction === 'next' || direction === 'prev')) {
      const flipSheet = document.createElement('div');
      flipSheet.className = `page-flip-sheet flip-${direction}`;
      flipSheet.setAttribute('aria-hidden', 'true');

      const front = document.createElement('div');
      front.className = 'page-flip-front';
      const contentStyle = getComputedStyle(content);
      front.style.padding = `${contentStyle.paddingTop} ${contentStyle.paddingRight} ${contentStyle.paddingBottom} ${contentStyle.paddingLeft}`;
      const oldPageFace = previousPage.cloneNode(true);
      front.appendChild(oldPageFace);

      const back = document.createElement('div');
      back.className = 'page-flip-back';
      flipSheet.append(front, back);
      content.appendChild(flipSheet);
      content.classList.add('page-turning');
      flipSheet.addEventListener('animationend', () => {
        if (flipSheet.parentElement === content) {
          flipSheet.remove();
          content.classList.remove('page-turning');
        }
      }, { once: true });
    }
    content.scrollTop = 0;
    $('pageInfo').textContent = `${book.pageIndex + 1} / ${book.pages.length}`;
    $('pageSlider').value = book.pageIndex + 1;

    // 更新目录高亮
    updateTocActive();
    // 保存进度
    saveProgress(book.id, book.pageIndex);
    // 记录阅读历史
    saveHistory();
  }

  function renderPageContent(page, idx) {
    const lines = page.content.split(/\n+/).filter((l) => l.trim().length > 0);
    let html = '';
    if (page.isChapterStart) {
      html += `<h3 class="chapter-title">${escapeHtml(page.chapter)}</h3>`;
    }
    for (const line of lines) {
      html += `<p>${escapeHtml(line.trim())}</p>`;
    }
    return html;
  }

  // ---------- 目录 ----------
  function renderToc() {
    const book = state.currentBook;
    if (!book) return;
    const list = $('tocList');
    list.innerHTML = '';
    // 找到每章起始页
    const seen = new Set();
    book.pages.forEach((p, i) => {
      if (!seen.has(p.chapter)) {
        seen.add(p.chapter);
        const item = document.createElement('div');
        item.className = 'toc-item';
        item.textContent = p.chapter;
        item.dataset.page = i;
        item.addEventListener('click', () => {
          book.pageIndex = i;
          renderPage();
          $('tocPanel').classList.remove('open');
        });
        list.appendChild(item);
      }
    });
  }

  function updateTocActive() {
    const book = state.currentBook;
    if (!book) return;
    const page = book.pages[book.pageIndex];
    document.querySelectorAll('.toc-item').forEach((it) => {
      it.classList.toggle('active', it.textContent === page.chapter);
    });
  }

  // ---------- 翻页 ----------
  function nextPage() {
    const book = state.currentBook;
    if (!book) return;
    if (book.pageIndex < book.pages.length - 1) {
      book.pageIndex++;
      renderPage('next');
    }
  }
  function prevPage() {
    const book = state.currentBook;
    if (!book) return;
    if (book.pageIndex > 0) {
      book.pageIndex--;
      renderPage('prev');
    }
  }

  $('nextPageBtn').addEventListener('click', nextPage);
  $('prevPageBtn').addEventListener('click', prevPage);
  $('pageSlider').addEventListener('input', (e) => {
    const book = state.currentBook;
    if (!book) return;
    const nextIndex = parseInt(e.target.value, 10) - 1;
    const direction = nextIndex > book.pageIndex ? 'next' : nextIndex < book.pageIndex ? 'prev' : '';
    book.pageIndex = nextIndex;
    renderPage(direction);
  });

  $('backBtn').addEventListener('click', () => {
    switchView(lastView);
    if (lastView === 'shelf') renderShelf();
    else if (lastView === 'history') renderHistory();
    else {
      renderLibrary(); // 刷新进度条与收藏星标
      renderContinueCard();
    }
  });

  // ---------- 目录面板 ----------
  $('tocBtn').addEventListener('click', () => $('tocPanel').classList.toggle('open'));
  $('tocCloseBtn').addEventListener('click', () => $('tocPanel').classList.remove('open'));

  // ---------- 字号 ----------
  function setFontSize(size) {
    state.fontSize = Math.max(12, Math.min(32, size));
    document.documentElement.style.setProperty('--font-size', state.fontSize + 'px');
    localStorage.setItem('dao_font_size', state.fontSize);
    requestAnimationFrame(reflowCurrentBook);
  }
  $('fontIncBtn').addEventListener('click', () => setFontSize(state.fontSize + 1));
  $('fontDecBtn').addEventListener('click', () => setFontSize(state.fontSize - 1));

  // ---------- 主题 ----------
  const themes = ['', 'theme-sepia', 'theme-dark'];
  function setTheme(t) {
    state.theme = t;
    themes.forEach((th) => { if (th) document.body.classList.remove(th); });
    if (t) document.body.classList.add(t);
    localStorage.setItem('dao_theme', t);
  }
  setTheme(state.theme);
  $('themeBtn').addEventListener('click', () => {
    const idx = themes.indexOf(state.theme);
    setTheme(themes[(idx + 1) % themes.length]);
  });

  // ---------- 全文搜索 ----------
  const searchOverlay = $('searchOverlay');
  $('searchInBookBtn').addEventListener('click', () => {
    searchOverlay.classList.remove('hidden');
    $('searchInBookInput').focus();
  });
  $('closeSearchBtn').addEventListener('click', () => searchOverlay.classList.add('hidden'));

  $('searchInBookInput').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const results = $('searchResults');
    results.innerHTML = '';
    if (!q) return;
    const book = state.currentBook;
    if (!book) return;

    const lowerQ = q.toLowerCase();
    let count = 0;
    book.pages.forEach((p, i) => {
      const idx = p.content.toLowerCase().indexOf(lowerQ);
      if (idx >= 0) {
        count++;
        const start = Math.max(0, idx - 20);
        const end = Math.min(p.content.length, idx + q.length + 20);
        const snippet = p.content.slice(start, end);
        const highlighted = escapeHtml(snippet).replace(
          new RegExp(escapeRegex(q), 'gi'),
          (m) => `<mark>${m}</mark>`
        );
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div>${escapeHtml(p.chapter)} · 第 ${i + 1} 页</div>
          <div class="snippet">…${highlighted}…</div>
        `;
        item.addEventListener('click', () => {
          book.pageIndex = i;
          renderPage();
          searchOverlay.classList.add('hidden');
        });
        results.appendChild(item);
        if (count >= 100) return;
      }
    });
    if (count === 0) {
      results.innerHTML = '<div class="empty">未找到相关内容</div>';
    }
  });

  // ---------- 键盘快捷键 ----------
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!views.reader.classList.contains('active')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      nextPage();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevPage();
    } else if (e.key === 'Escape') {
      searchOverlay.classList.add('hidden');
      $('tocPanel').classList.remove('open');
      setControlsVisible(true);
      if (views.reader.classList.contains('immersive')) setReaderImmersive(false);
    }
  });

  // ---------- 点击翻页（手机端常用操作） ----------
  // 左 30% = 上一页，右 30% = 下一页；沉浸模式中间区域保持纯阅读。
  function toggleControls() {
    if (views.reader.classList.contains('immersive')) return;
    const header = document.querySelector('.reader-header');
    const footer = document.querySelector('.reader-footer');
    const hidden = header.style.display === 'none';
    setControlsVisible(hidden);
  }
  function setControlsVisible(visible) {
    const immersive = views.reader.classList.contains('immersive');
    if (!immersive) {
      views.reader.classList.remove('controls-hidden', 'controls-visible');
      return;
    }
    views.reader.classList.toggle('controls-visible', visible);
    views.reader.classList.toggle('controls-hidden', !visible);
    if (!visible) $('tocPanel').classList.remove('open');
  }
  function scheduleControlsHide() {
    window.clearTimeout(controlsHideTimer);
    if (!views.reader.classList.contains('immersive')) return;
    controlsHideTimer = window.setTimeout(() => {
      setControlsVisible(false);
      controlsHideTimer = 0;
    }, 3000);
  }

  const readerBody = document.querySelector('.reader-body');
  let pressStartX = 0;
  let pressStartY = 0;
  views.reader.addEventListener('pointerdown', (e) => {
    if (!views.reader.classList.contains('immersive')) return;
    const onControls = e.target.closest('.reader-header, .reader-footer, .toc-panel, .search-overlay, button, input, a');
    if (onControls) {
      window.clearTimeout(controlsHideTimer);
      controlsHideTimer = 0;
      return;
    }
    pressStartX = e.clientX;
    pressStartY = e.clientY;
    longPressTriggered = false;
    window.clearTimeout(longPressTimer);
    longPressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      setControlsVisible(true);
    }, 520);
  });
  views.reader.addEventListener('pointermove', (e) => {
    if (!longPressTimer) return;
    if (Math.abs(e.clientX - pressStartX) > 12 || Math.abs(e.clientY - pressStartY) > 12) {
      window.clearTimeout(longPressTimer);
      longPressTimer = 0;
    }
  });
  function finishReaderPointer(e) {
    if (!views.reader.classList.contains('immersive')) return;
    window.clearTimeout(longPressTimer);
    longPressTimer = 0;
    const onControls = e.target.closest('.reader-header, .reader-footer, .toc-panel, .search-overlay, button, input, a');
    if (longPressTriggered) {
      suppressReaderClick = true;
      window.setTimeout(() => { suppressReaderClick = false; }, 500);
      scheduleControlsHide();
    } else if (onControls || views.reader.classList.contains('controls-visible')) {
      scheduleControlsHide();
    }
    longPressTriggered = false;
  }
  views.reader.addEventListener('pointerup', finishReaderPointer);
  views.reader.addEventListener('pointercancel', finishReaderPointer);

  readerBody.addEventListener('click', (e) => {
    if (suppressReaderClick) {
      suppressReaderClick = false;
      return;
    }
    // 如果点击的是按钮/控件区域则不处理
    if (e.target.closest('button, input, a, .toc-panel')) return;
    const rect = readerBody.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    if (ratio < 0.3) {
      prevPage();
    } else if (ratio > 0.7) {
      nextPage();
    } else {
      if (!views.reader.classList.contains('immersive')) toggleControls();
    }
  });

  // ---------- 滑动翻页 ----------
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;
  readerBody.addEventListener('touchstart', (e) => {
    if (e.target.closest('.toc-panel, button, input, a')) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchMoved = false;
  }, { passive: true });
  readerBody.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - touchStartX) > 10 || Math.abs(t.clientY - touchStartY) > 10) {
      touchMoved = true;
    }
  }, { passive: true });
  readerBody.addEventListener('touchend', (e) => {
    if (e.target.closest('.toc-panel, button, input, a')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    // 水平滑动距离 > 50px 且水平位移大于垂直位移
    if (touchMoved && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) nextPage();
      else prevPage();
    }
  });

  let readerResizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(readerResizeTimer);
    readerResizeTimer = window.setTimeout(reflowCurrentBook, 120);
  });

  // ---------- 进度存储 ----------
  const HISTORY_KEY = 'dao_history';
  const FAVORITES_KEY = 'dao_favorites';

  function readStoredList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeStoredList(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function loadHistory() {
    return readStoredList(HISTORY_KEY)
      .filter((entry) => entry && entry.id && entry.name)
      .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
  }

  function saveHistory() {
    const book = state.currentBook;
    if (!book || !book.pages.length) return;
    const page = book.pages[book.pageIndex];
    const history = loadHistory().filter((entry) => entry.id !== book.id);
    history.unshift({
      id: book.id,
      name: book.name,
      path: book.path,
      pageIndex: book.pageIndex,
      pageCount: book.pages.length,
      chapter: page.chapter,
      chapterOffset: page.startOffset || 0,
      lastReadAt: Date.now(),
    });
    writeStoredList(HISTORY_KEY, history.slice(0, 100));
    renderContinueCard();
  }

  function renderContinueCard() {
    const entry = loadHistory()[0];
    const card = $('continueCard');
    card.classList.toggle('hidden', !entry);
    if (!entry) return;
    const page = (entry.pageIndex || 0) + 1;
    const pageCount = Math.max(1, entry.pageCount || 1);
    const progress = Math.round((page / pageCount) * 100);
    $('continueName').textContent = entry.name;
    $('continueProgress').textContent = `${entry.chapter || '正文'} · 第 ${page} / ${pageCount} 页 · ${progress}%`;
  }

  function renderHistory() {
    const entries = loadHistory();
    const container = $('historyContent');
    $('historyCount').textContent = `${entries.length} 本`;
    container.innerHTML = '';
    if (!entries.length) {
      container.innerHTML = '<div class="empty">还没有阅读记录</div>';
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `继续阅读《${entry.name}》`);
      const page = (entry.pageIndex || 0) + 1;
      const pageCount = Math.max(1, entry.pageCount || 1);
      const progress = Math.round((page / pageCount) * 100);
      const favorite = isFavorite(entry.id);
      item.innerHTML = `
        <div class="history-main">
          <div class="history-text">
            <div class="history-name">${escapeHtml(entry.name)}</div>
            <div class="history-meta">${escapeHtml(entry.chapter || '正文')} · 第 ${page} / ${pageCount} 页 · ${formatDate(entry.lastReadAt)}</div>
          </div>
          <button class="card-star ${favorite ? 'on' : ''}" type="button" aria-label="${favorite ? '移出书架' : '加入书架'}" title="${favorite ? '移出书架' : '加入书架'}">${favorite ? '★' : '☆'}</button>
        </div>
        <div class="history-progress"><span style="width:${progress}%"></span></div>
      `;
      item.addEventListener('click', () => openHistoryItem(entry));
      item.addEventListener('keydown', (event) => {
        if (event.target === item && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          openHistoryItem(entry);
        }
      });
      item.querySelector('.card-star').addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFavoriteById(entry.id, entry.name, entry.path);
        renderHistory();
      });
      container.appendChild(item);
    });
  }

  function renderShelf() {
    const favorites = readStoredList(FAVORITES_KEY);
    const container = $('shelfContent');
    $('shelfCount').textContent = `${favorites.length} 本`;
    container.innerHTML = '';
    if (!favorites.length) {
      container.innerHTML = '<div class="empty">书架还是空的，阅读时点按 ☆ 即可收藏</div>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'book-grid';
    const history = loadHistory();
    favorites.forEach((favorite) => {
      grid.appendChild(createBookCard({ ...favorite, size: favorite.size || 0 }, history));
    });
    container.appendChild(grid);
  }

  function createBookCard(book, historyEntries = loadHistory()) {
    const card = document.createElement('div');
    card.className = 'book-card';
    const favorite = isFavorite(book.id);
    const history = historyEntries.find((entry) => entry.id === book.id);
    const serverBook = book.path ? (book.size ? book : findServerBook(book.path)) : null;
    let progress = serverBook ? getProgress(serverBook) : 0;
    if (history && history.pageCount) {
      progress = Math.round((((history.pageIndex || 0) + 1) / history.pageCount) * 100);
    }
    const meta = (book.size || serverBook?.size)
      ? formatSize(book.size || serverBook.size)
      : (book.id.startsWith('upload:') ? '上传的 TXT' : 'TXT');
    card.innerHTML = `
      <button class="card-star ${favorite ? 'on' : ''}" type="button" aria-label="${favorite ? '移出书架' : '加入书架'}" title="${favorite ? '移出书架' : '加入书架'}">${favorite ? '★' : '☆'}</button>
      <div class="title">${escapeHtml(book.name)}</div>
      <div class="meta">${meta}</div>
      <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
    `;
    card.querySelector('.card-star').addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavoriteById(book.id, book.name, book.path, book.size);
      if (views.shelf.classList.contains('active')) renderShelf();
      else renderLibrary();
    });
    card.addEventListener('click', () => {
      if (book.id.startsWith('server:') || book.path) openServerBook(book);
      else openUploadedBook(book.id);
    });
    return card;
  }

  function isFavorite(id) {
    return readStoredList(FAVORITES_KEY).some((entry) => entry.id === id);
  }

  function toggleFavoriteById(id, name, path = '', size = 0) {
    const favorites = readStoredList(FAVORITES_KEY);
    const index = favorites.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      favorites.splice(index, 1);
    } else {
      favorites.unshift({ id, name, path, size, addedAt: Date.now() });
    }
    writeStoredList(FAVORITES_KEY, favorites);
  }

  function updateFavBtn() {
    const book = state.currentBook;
    const favorite = Boolean(book && isFavorite(book.id));
    const button = $('favBtn');
    button.textContent = favorite ? '★' : '☆';
    button.classList.toggle('on', favorite);
    button.title = favorite ? '移出书架' : '加入书架';
    button.setAttribute('aria-label', button.title);
  }

  function findServerBook(path) {
    const groups = state.books.groups || {};
    return Object.values(groups).flat().find((book) => book.path === path) || null;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  // 上传文件的正文单独存入 IndexedDB，避免 localStorage 的容量限制。
  let uploadDbPromise;
  function openUploadDb() {
    if (!window.indexedDB) return Promise.reject(new Error('浏览器不支持本地书籍存储'));
    if (!uploadDbPromise) {
      uploadDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('dao_reader', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('uploads')) {
            request.result.createObjectStore('uploads', { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch((error) => {
        uploadDbPromise = null;
        throw error;
      });
    }
    return uploadDbPromise;
  }

  async function saveUploadedBook(book) {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('uploads', 'readwrite');
      transaction.objectStore('uploads').put(book);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('保存上传文件失败'));
    });
  }

  async function getUploadedBook(id) {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction('uploads', 'readonly').objectStore('uploads').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function progressKey(id) {
    return 'dao_progress_' + id;
  }
  function saveProgress(id, page) {
    try {
      localStorage.setItem(progressKey(id), String(page));
    } catch {}
  }
  function loadProgress(id) {
    try {
      const v = localStorage.getItem(progressKey(id));
      const page = v ? parseInt(v, 10) : 0;
      return Number.isFinite(page) ? page : 0;
    } catch {
      return 0;
    }
  }
  function getProgress(book) {
    if (!book) return 0;
    // 用页数估算进度（近似）
    const page = loadProgress('server:' + book.path);
    if (!page) return 0;
    // 估算总页数：按 size/pageSize*2（因为中文每页约 pageSize 字）
    const estPages = Math.max(1, Math.ceil(book.size / state.pageSize));
    return Math.min(100, Math.round((page / estPages) * 100));
  }

  // ---------- 工具 ----------
  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  // ---------- 初始化 ----------
  const savedFont = localStorage.getItem('dao_font_size');
  if (savedFont) setFontSize(parseInt(savedFont));

  loadLibrary();
})();
