(function(){
  function initPaperAbstractToggles(){
    document.querySelectorAll('[data-toggle-abstract]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var card = btn.closest('.paper-card');
        if(card){ card.classList.toggle('show-abstract'); }
      });
    });
  }

  function parseNewsItemsFromJsonText(jsonText){
    try {
      var items = JSON.parse(jsonText || '[]');
      return normalizeNewsItems(items);
    } catch (error) {
      console.error('Unable to parse news JSON:', error);
      return [];
    }
  }

  function normalizeNewsItems(items){
    return (items || [])
      .map(function(item){
        return {
          date: (item.date || '').trim(),
          category: (item.category || 'Update').trim(),
          headline: (item.headline || 'Lab update').trim(),
          summary: (item.summary || '').trim(),
          link: (item.link || '').trim()
        };
      })
      .filter(function(item){ return item.date && item.headline; })
      .sort(function(a, b){ return toDateValue(b.date) - toDateValue(a.date); });
  }

  function toDateValue(dateString){
    var d = new Date(dateString);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function formatDisplayDate(dateString){
    var d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateParts(dateString){
    var d = new Date(dateString);
    if (isNaN(d.getTime())) return { day: '', monthYear: dateString };
    return {
      day: d.toLocaleDateString('en-US', { day: '2-digit' }),
      monthYear: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    };
  }

  function getCategoryIcon(category){
    var map = { Paper: 'fa-file-lines', Grant: 'fa-flask-vial', People: 'fa-user-graduate', Award: 'fa-award', Event: 'fa-calendar-check' };
    return map[category] || 'fa-bolt';
  }

  function categorySlug(category){
    return String(category || 'update').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  async function fetchNewsItemsFromPage(url){
    var response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP error ' + response.status);
    var htmlText = await response.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(htmlText, 'text/html');
    return parseNewsItemsFromDocument(doc);
  }

  function parseNewsItemsFromDocument(doc){
    if (!doc) return [];
    var jsonScript = doc.querySelector('#news-data');
    if (jsonScript) return parseNewsItemsFromJsonText(jsonScript.textContent);
    var fallbackItems = [];
    doc.querySelectorAll('[data-news-item]').forEach(function(node){
      var headlineNode = node.querySelector('.news-headline, .news-copy');
      var summaryNode = node.querySelector('.news-summary, .news-copy');
      fallbackItems.push({
        date: node.getAttribute('data-date') || '',
        category: node.getAttribute('data-category') || 'Update',
        headline: node.getAttribute('data-headline') || (headlineNode ? headlineNode.textContent : 'Lab update'),
        summary: node.getAttribute('data-summary') || (summaryNode ? summaryNode.textContent : '')
      });
    });
    return normalizeNewsItems(fallbackItems);
  }

  function renderNewsPage(){
    var jsonScript = document.getElementById('news-data');
    var featuredContainer = document.getElementById('featured-news-grid');
    var archiveContainer = document.getElementById('news-archive-grid');
    if (!jsonScript || !featuredContainer || !archiveContainer) return;

    var items = parseNewsItemsFromJsonText(jsonScript.textContent);
    var filters = Array.from(document.querySelectorAll('[data-news-filter]'));
    renderFeatured(items.slice(0, 6), featuredContainer);
    renderArchive(items, archiveContainer, 'all');
    updateStats(items);

    filters.forEach(function(btn){
      btn.addEventListener('click', function(){
        filters.forEach(function(el){ el.classList.remove('active'); });
        btn.classList.add('active');
        renderArchive(items, archiveContainer, btn.getAttribute('data-news-filter') || 'all');
      });
    });
  }

  function renderFeatured(items, container){
    container.innerHTML = '';
    items.forEach(function(item, index){
      var article = document.createElement('article');
      article.className = index === 0 ? 'featured-news-card featured-news-card-lg' : 'featured-news-card';
      article.innerHTML = '<div class="featured-news-top"><span class="news-pill news-pill-' + categorySlug(item.category) + '"><i class="fa-solid ' + getCategoryIcon(item.category) + '"></i> ' + escapeHtml(item.category) + '</span><span class="featured-news-date">' + escapeHtml(formatDisplayDate(item.date)) + '</span></div><h3 class="featured-news-title">' + escapeHtml(item.headline) + '</h3><p class="featured-news-summary">' + escapeHtml(item.summary) + '</p>';
      container.appendChild(article);
    });
  }

  function renderArchive(items, container, filter){
    var filtered = items.filter(function(item){ return filter === 'all' || item.category.toLowerCase() === filter.toLowerCase(); });
    container.innerHTML = '';
    if (!filtered.length) {
      container.innerHTML = '<div class="news-empty-state">No news entries match this category.</div>';
      return;
    }
    filtered.forEach(function(item){
      var article = document.createElement('article');
      article.className = 'news-archive-card';
      article.setAttribute('data-news-item', '');
      article.setAttribute('data-date', item.date);
      article.setAttribute('data-category', item.category);
      article.innerHTML = '<div class="news-archive-date">' + escapeHtml(formatDisplayDate(item.date)) + '</div><div class="news-archive-body"><span class="news-pill news-pill-' + categorySlug(item.category) + '"><i class="fa-solid ' + getCategoryIcon(item.category) + '"></i> ' + escapeHtml(item.category) + '</span><h3 class="news-archive-title">' + escapeHtml(item.headline) + '</h3><p class="news-archive-summary">' + escapeHtml(item.summary) + '</p></div>';
      container.appendChild(article);
    });
  }

  function updateStats(items){
    var totalEl = document.querySelector('[data-news-stat="total"]');
    var latestYearEl = document.querySelector('[data-news-stat="latest-year"]');
    var paperEl = document.querySelector('[data-news-stat="paper"]');
    var grantEl = document.querySelector('[data-news-stat="grant"]');
    if (totalEl) totalEl.textContent = String(items.length);
    if (latestYearEl && items.length) latestYearEl.textContent = String(new Date(items[0].date).getFullYear());
    if (paperEl) paperEl.textContent = String(items.filter(function(item){ return item.category === 'Paper'; }).length);
    if (grantEl) grantEl.textContent = String(items.filter(function(item){ return item.category === 'Grant'; }).length);
  }

  function escapeHtml(text){
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }



  function initPublicationArchive(){
    document.querySelectorAll('.archive-source-list').forEach(function(sourceList){
      if (sourceList.dataset.archiveEnhanced === 'true') return;
      sourceList.dataset.archiveEnhanced = 'true';
      var root = sourceList.parentElement;
      if (!root) return;
      var searchInput = root.querySelector('[data-archive-search]');
      var yearPills = root.querySelector('[data-archive-years]');
      var results = root.querySelector('[data-archive-results]');
      var emptyState = root.querySelector('[data-archive-empty]');
      var countLabel = root.querySelector('[data-archive-count]');
      var clearBtn = root.querySelector('[data-archive-clear]');
      if (!yearPills || !results) return;

      var cards = Array.from(sourceList.querySelectorAll('.paper-card')).map(function(card){
        var title = (card.querySelector('.paper-title') ? card.querySelector('.paper-title').textContent : '').trim();
        var meta = (card.querySelector('.paper-meta') ? card.querySelector('.paper-meta').textContent : '').trim();
        var abstract = (card.querySelector('.abstract') ? card.querySelector('.abstract').textContent : '').trim();
        var year = String(card.getAttribute('data-year') || '').trim() || 'Unknown';
        card.setAttribute('data-origin-year', year);
        return {
          node: card,
          title: title,
          meta: meta,
          abstract: abstract,
          year: year,
          searchText: (title + ' ' + meta + ' ' + abstract + ' ' + year).toLowerCase()
        };
      });

      var years = Array.from(new Set(cards.map(function(item){ return item.year; })))
        .sort(function(a, b){ return parseInt(b, 10) - parseInt(a, 10); });

      var state = { year: 'all', query: '' };

      function renderYearPills(){
        yearPills.innerHTML = '';
        var allBtn = createYearButton('All', 'all');
        yearPills.appendChild(allBtn);
        years.forEach(function(year){
          yearPills.appendChild(createYearButton(year, year));
        });
      }

      function createYearButton(label, value){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'archive-year-pill' + (state.year === value ? ' active' : '');
        btn.textContent = label;
        btn.setAttribute('data-year-filter', value);
        btn.addEventListener('click', function(){
          state.year = value;
          render();
        });
        return btn;
      }

      function render(){
        if (searchInput) state.query = (searchInput.value || '').trim().toLowerCase();
        var filtered = cards.filter(function(item){
          var yearOk = state.year === 'all' || item.year === state.year;
          var queryOk = !state.query || item.searchText.indexOf(state.query) !== -1;
          return yearOk && queryOk;
        });

        yearPills.querySelectorAll('.archive-year-pill').forEach(function(btn){
          btn.classList.toggle('active', btn.getAttribute('data-year-filter') === state.year);
        });

        results.innerHTML = '';
        if (!filtered.length){
          if (emptyState) {
            emptyState.style.display = 'block';
            results.appendChild(emptyState);
          }
          if (countLabel) countLabel.textContent = '0 papers found';
          return;
        }

        if (emptyState) emptyState.style.display = 'none';

        var groups = {};
        filtered.forEach(function(item){
          if (!groups[item.year]) groups[item.year] = [];
          groups[item.year].push(item);
        });

        Object.keys(groups)
          .sort(function(a,b){ return parseInt(b, 10) - parseInt(a, 10); })
          .forEach(function(year, index){
            var section = document.createElement('section');
            section.className = 'year-group';

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'year-group-toggle' + (index === 0 ? ' is-open' : '');
            button.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
            button.innerHTML = '<span class="year-group-left"><span class="year-badge">' + escapeHtml(year) + '</span><span class="year-group-count">' + groups[year].length + ' paper' + (groups[year].length > 1 ? 's' : '') + '</span></span><span class="year-group-icon"><i class="fa-solid fa-chevron-down"></i></span>';

            var body = document.createElement('div');
            body.className = 'year-group-body' + (index === 0 ? ' is-open' : '');

            groups[year].forEach(function(item){
              var clone = item.node.cloneNode(true);
              body.appendChild(clone);
            });

            button.addEventListener('click', function(){
              var open = button.classList.toggle('is-open');
              body.classList.toggle('is-open', open);
              button.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            section.appendChild(button);
            section.appendChild(body);
            results.appendChild(section);
          });

        if (countLabel){
          var label = filtered.length + ' paper' + (filtered.length > 1 ? 's' : '') + ' found';
          if (state.year !== 'all') label += ' · ' + state.year;
          if (state.query) label += ' · keyword: ' + state.query;
          countLabel.textContent = label;
        }

        initPaperAbstractToggles();
      }

      renderYearPills();
      render();

      if (searchInput){
        searchInput.addEventListener('input', render);
      }
      if (clearBtn){
        clearBtn.addEventListener('click', function(){
          state.year = 'all';
          state.query = '';
          if (searchInput) searchInput.value = '';
          render();
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    initPaperAbstractToggles();
    initPublicationArchive();
    renderNewsPage();
  });

  window.SRISNews = {
    parseNewsItemsFromDocument: parseNewsItemsFromDocument,
    fetchNewsItemsFromPage: fetchNewsItemsFromPage,
    formatDisplayDate: formatDisplayDate,
    formatDateParts: formatDateParts,
    getCategoryIcon: getCategoryIcon,
    categorySlug: categorySlug,
    escapeHtml: escapeHtml
  };
})();
