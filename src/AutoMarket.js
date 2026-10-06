/* AutoMarket - Cookie Clicker mod (ES5)
 * Fisier gazduit pe GitHub. Se incarca cu Game.LoadMod(url) sau prin @require.
 * Cumpara/vinde automat in minigame-ul Market pe baza unor praguri.
 */
(function () {
  'use strict';

  console.log('[AutoMarket] 1. fisier incarcat');

  // Asteapta incarcarea completa a jocului (functioneaza si daca Game e deja gata)
  function boot() {
    if (typeof Game === 'undefined' || !Game.ready || !Game.Objects) {
      setTimeout(boot, 500);
      return;
    }
    install();
  }

  function install() {
    console.log('[AutoMarket] 2. Game gata, instalez modul');

    // Evita incarcarea dubla (ar dubla bucla de trading)
    if (Game.mods && Game.mods['autoMarket']) {
      console.log('[AutoMarket] deja instalat, ies');
      return;
    }

    /* -------------------------------------------------------- */
    /* Stock: o actiune din Market                              */
    /* -------------------------------------------------------- */
    // Tinem doar id-ul, nu referinta la obiectul good; il resolvam
    // la fiecare acces ca sa nu ramanem cu date vechi (ex. dupa Ascend).
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
      // buyGood returneaza false daca nu ai destule cookies
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

    var AutoMarket = {
      cfg: { enabled: true, intervalMs: 1500, goods: {} },
      stocks: [],
      waitTimer: null,
      tradeTimer: null,

      log: function (msg) {
        console.log('[AutoMarket] ' + msg);
      },

      getMinigame: function () {
        var bank = Game.Objects['Bank'];
        return (bank && bank.minigame && bank.minigame.goodsById) ? bank.minigame : null;
      },

      // Creeaza obiectele Stock din minigame + setarile salvate
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
            saved ? saved.enabled : false   // implicit oprit
          ));
        }
        this.log('4. Initializat ' + this.stocks.length + ' actiuni.');
      },

      // Bucla de trading
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

      // Apelat automat de joc la registerMod. Asteapta minigame-ul Bank.
      init: function () {
        var self = this;
        this.log('3. mod inregistrat; astept minigame-ul Bank (necesita Bank nivel 1)');
        if (Game.Notify) { Game.Notify('AutoMarket', 'Modul a fost incarcat', [16, 5], 6); }
        this.waitTimer = setInterval(function () {
          if (self.getMinigame()) {
            clearInterval(self.waitTimer);
            self.waitTimer = null;
            self.build();
            self.start();
          }
        }, 1000);
      },

      // Salvare / incarcare (apelate automat de joc)
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
      }
    };

    Game.registerMod('autoMarket', AutoMarket);
  }

  boot();
})();