/* AutoMarket - Cookie Clicker mod (ES5), v0.2
 * Cumpara/vinde automat in minigame-ul Market pe baza unor praguri.
 * Adauga in Options o sectiune "AutoMarket" cu praguri per actiune.
 */
(function () {
  'use strict';

  console.log('[AutoMarket] 1. fisier incarcat');

  function boot() {
    if (typeof Game === 'undefined' || !Game.ready || !Game.Objects) {
      setTimeout(boot, 500);
      return;
    }
    install();
  }

  function install() {
    console.log('[AutoMarket] 2. Game gata, instalez modul');

    if (Game.mods && Game.mods['autoMarket']) {
      console.log('[AutoMarket] deja instalat, ies');
      return;
    }

    /* -------------------------------------------------------- */
    /* Stock: o actiune din Market                              */
    /* enabled = actiunea este "adaugata" in AutoMarket         */
    /* -------------------------------------------------------- */
    function Stock(id, lowPrice, highPrice, enabled) {
      this.id = id;
      this.lowPrice = lowPrice;
      this.highPrice = highPrice;
      this.enabled = enabled;
    }

    Stock.prototype.getMinigame = function () {
      var bank = Game.Objects['Bank'];
      return (bank && bank.minigame) ? bank.minigame : null;
    };

    Stock.prototype.getGood = function () {
      var M = this.getMinigame();
      return (M && M.goodsById) ? M.goodsById[this.id] : null;
    };

    Stock.prototype.getName = function () {
      var g = this.getGood();
      return g ? g.name : '?';
    };

    Stock.prototype.getBuildingName = function () {
      var g = this.getGood();
      return (g && g.building && g.building.name) ? g.building.name : '';
    };

    // Cladirea asociata actiunii este detinuta? (daca nu putem afla, consideram ca da)
    Stock.prototype.isBuildingOwned = function () {
      var g = this.getGood();
      if (g && g.building && typeof g.building.amount === 'number') {
        return g.building.amount > 0;
      }
      return true;
    };

    Stock.prototype.getPrice = function () {
      var g = this.getGood();
      return g ? g.val : 0;
    };

    Stock.prototype.getOwned = function () {
      var g = this.getGood();
      return g ? g.stock : 0;
    };

    Stock.prototype.getMaxStock = function () {
      var M = this.getMinigame();
      var g = this.getGood();
      return (M && g) ? M.getGoodMaxStock(g) : 0;
    };

    Stock.prototype.buy = function () {
      var M = this.getMinigame();
      var g = this.getGood();
      if (!M || !g || !this.enabled) { return false; }
      if (g.val >= this.lowPrice) { return false; }
      var room = this.getMaxStock() - g.stock;
      if (room <= 0) { return false; }
      return M.buyGood(this.id, room);
    };

    Stock.prototype.sell = function () {
      var M = this.getMinigame();
      var g = this.getGood();
      if (!M || !g || !this.enabled) { return false; }
      if (g.val <= this.highPrice) { return false; }
      if (g.stock <= 0) { return false; }
      return M.sellGood(this.id, g.stock);
    };

    Stock.prototype.tick = function () {
      this.sell();
      this.buy();
    };

    /* -------------------------------------------------------- */
    /* Modul                                                    */
    /* -------------------------------------------------------- */
    var DEFAULT_LOW = 10;
    var DEFAULT_HIGH = 50;
    var SECTION_ID = 'autoMarketSection';

    var AutoMarket = {
      cfg: { enabled: true, intervalMs: 1500, goods: {} },
      stocks: [],
      waitTimer: null,
      tradeTimer: null,
      menuHooked: false,

      log: function (msg) {
        console.log('[AutoMarket] ' + msg);
      },

      getMinigame: function () {
        var bank = Game.Objects['Bank'];
        return (bank && bank.minigame && bank.minigame.goodsById) ? bank.minigame : null;
      },

      build: function () {
        var M = this.getMinigame();
        var i, good, saved;
        this.stocks = [];
        for (i = 0; i < M.goodsById.length; i++) {
          good = M.goodsById[i];
          saved = this.cfg.goods[good.id];
          this.stocks.push(new Stock(
            good.id,
            saved ? saved.low : DEFAULT_LOW,
            saved ? saved.high : DEFAULT_HIGH,
            saved ? saved.enabled : false
          ));
        }
        this.log('4. Initializat ' + this.stocks.length + ' actiuni.');
      },

      tick: function () {
        var i;
        if (!this.cfg.enabled || !this.getMinigame()) { return; }
        for (i = 0; i < this.stocks.length; i++) {
          try {
            this.stocks[i].tick();
          } catch (e) {
            this.log('Eroare la ' + this.stocks[i].id + ': ' + e);
          }
        }
      },

      start: function () {
        var self = this;
        if (this.tradeTimer) { clearInterval(this.tradeTimer); }
        this.tradeTimer = setInterval(function () { self.tick(); }, this.cfg.intervalMs);
      },

      init: function () {
        var self = this;
        this.log('3. mod inregistrat; astept minigame-ul Bank (necesita Bank nivel 1)');
        if (Game.Notify) { Game.Notify('AutoMarket', 'Modul a fost incarcat', [16, 5], 6); }
        this.hookMenu();
        this.waitTimer = setInterval(function () {
          if (self.getMinigame()) {
            clearInterval(self.waitTimer);
            self.waitTimer = null;
            self.build();
            self.start();
            self.renderMenu();   // daca Options e deschis, actualizeaza sectiunea
          }
        }, 1000);
      },

      save: function () {
        var i, s;
        if (this.stocks.length) {
          this.cfg.goods = {};
          for (i = 0; i < this.stocks.length; i++) {
            s = this.stocks[i];
            this.cfg.goods[s.id] = { low: s.lowPrice, high: s.highPrice, enabled: s.enabled };
          }
        }
        return JSON.stringify(this.cfg);
      },

      load: function (str) {
        try {
          var data = JSON.parse(str);
          this.cfg.enabled = (data.enabled !== false);
          this.cfg.intervalMs = data.intervalMs || 1500;
          this.cfg.goods = data.goods || {};
        } catch (e) {
          this.log('Salvare invalida, folosesc valorile implicite.');
        }
      },

      /* ------------------------------------------------------ */
      /* Interfata in Options                                   */
      /* ------------------------------------------------------ */

      // Se ataseaza o singura data la redesenarea meniului Options
      hookMenu: function () {
        var self = this;
        var inject = function () { self.renderMenu(); };
        if (this.menuHooked) { return; }
        this.menuHooked = true;

        if (Game.customOptionsMenu && typeof Game.customOptionsMenu.push === 'function') {
          Game.customOptionsMenu.push(inject);
        } else {
          // varianta de rezerva: invelim UpdateMenu
          var orig = Game.UpdateMenu;
          Game.UpdateMenu = function () {
            orig.apply(this, arguments);
            if (Game.onMenu === 'prefs') { inject(); }
          };
        }
      },

      parseNum: function (text) {
        var n = parseFloat(String(text).replace(',', '.'));
        return (isFinite(n) && n >= 0) ? n : null;
      },

      saveGame: function () {
        try { if (Game.WriteSave) { Game.WriteSave(); } } catch (e) { /* ignora */ }
      },

      makeButton: function (label, onClick) {
        var a = document.createElement('a');
        a.className = 'option';
        a.style.marginLeft = '6px';
        a.appendChild(document.createTextNode(label));
        a.addEventListener('click', onClick, false);
        return a;
      },

      makeInput: function (value, placeholder) {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.size = 7;
        inp.style.marginLeft = '6px';
        inp.placeholder = placeholder;
        inp.value = String(value);
        return inp;
      },

      statusText: function (stock) {
        return stock.enabled ? '[in AutoMarket]' : '[inactiv]';
      },

      buildRow: function (stock) {
        var self = this;
        var row = document.createElement('div');
        row.className = 'listing';

        var name = stock.getName();
        var b = stock.getBuildingName();
        var label = document.createElement('span');
        label.appendChild(document.createTextNode(
          name + (b ? ' (' + b + ')' : '') +
          ' - pret ' + stock.getPrice().toFixed(2) +
          ', stoc ' + stock.getOwned() + ' '
        ));

        var status = document.createElement('span');
        status.appendChild(document.createTextNode(this.statusText(stock)));

        var lowInput = this.makeInput(stock.lowPrice, 'low');
        var highInput = this.makeInput(stock.highPrice, 'high');

        var msg = document.createElement('span');
        msg.style.marginLeft = '8px';
        msg.style.opacity = '0.8';

        // Citeste si valideaza valorile din casute; returneaza true daca au fost aplicate
        function apply() {
          var low = self.parseNum(lowInput.value);
          var high = self.parseNum(highInput.value);
          if (low === null || high === null) {
            msg.textContent = 'Introdu numere valide (ex. 12.5)';
            return false;
          }
          if (low >= high) {
            msg.textContent = 'low trebuie sa fie mai mic decat high';
            return false;
          }
          stock.lowPrice = low;
          stock.highPrice = high;
          return true;
        }

        var setBtn = this.makeButton('Set', function () {
          if (apply()) {
            msg.textContent = 'Valori setate';
            self.saveGame();
          }
        });

        // Add: aplica valorile din casute si adauga actiunea in AutoMarket
        var addBtn = this.makeButton('Add', function () {
          if (apply()) {
            stock.enabled = true;
            status.textContent = self.statusText(stock);
            msg.textContent = 'Adaugat';
            self.saveGame();
          }
        });

        // Delete: scoate actiunea din AutoMarket (pastreaza pragurile)
        var delBtn = this.makeButton('Delete', function () {
          stock.enabled = false;
          status.textContent = self.statusText(stock);
          msg.textContent = 'Sters din AutoMarket';
          self.saveGame();
        });

        row.appendChild(label);
        row.appendChild(status);
        row.appendChild(document.createElement('br'));
        row.appendChild(document.createTextNode('low'));
        row.appendChild(lowInput);
        row.appendChild(document.createTextNode(' high'));
        row.appendChild(highInput);
        row.appendChild(setBtn);
        row.appendChild(addBtn);
        row.appendChild(delBtn);
        row.appendChild(msg);
        return row;
      },

      renderMenu: function () {
        var self = this;
        var menu = document.getElementById('menu');
        var old = document.getElementById(SECTION_ID);
        var box, title, info, i, shown, toggle, refresh, head;

        if (old && old.parentNode) { old.parentNode.removeChild(old); }
        if (!menu || Game.onMenu !== 'prefs') { return; }

        box = document.createElement('div');
        box.id = SECTION_ID;
        box.className = 'subsection';

        title = document.createElement('div');
        title.className = 'title';
        title.appendChild(document.createTextNode('AutoMarket'));
        box.appendChild(title);

        if (!this.getMinigame() || !this.stocks.length) {
          info = document.createElement('div');
          info.className = 'listing';
          info.appendChild(document.createTextNode(
            'Minigame-ul Market nu este incarcat (ai nevoie de Bank nivel 1).'));
          box.appendChild(info);
          menu.appendChild(box);
          return;
        }

        // comutator general + reimprospatare preturi
        head = document.createElement('div');
        head.className = 'listing';
        toggle = this.makeButton('AutoMarket: ' + (this.cfg.enabled ? 'ON' : 'OFF'), function () {
          self.cfg.enabled = !self.cfg.enabled;
          toggle.textContent = 'AutoMarket: ' + (self.cfg.enabled ? 'ON' : 'OFF');
          self.saveGame();
        });
        toggle.style.marginLeft = '0';
        refresh = this.makeButton('Reimprospateaza preturile', function () {
          self.renderMenu();
        });
        head.appendChild(toggle);
        head.appendChild(refresh);
        box.appendChild(head);

        shown = 0;
        for (i = 0; i < this.stocks.length; i++) {
          if (!this.stocks[i].isBuildingOwned()) { continue; }
          box.appendChild(this.buildRow(this.stocks[i]));
          shown++;
        }
        if (!shown) {
          info = document.createElement('div');
          info.className = 'listing';
          info.appendChild(document.createTextNode('Nu detii nicio cladire cu actiuni in Market.'));
          box.appendChild(info);
        }

        menu.appendChild(box);   // jos de tot, sub setarile normale
      }
    };

    Game.registerMod('autoMarket', AutoMarket);
  }

  boot();
})();