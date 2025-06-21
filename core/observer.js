;(function(window) {
  class Observer {
    observeTargetElement(containerToSearch = document.body, stopWhenFoundOne, querySelector, callback) {
      const container = containerToSearch;
      let alreadyFoundOne = false;
      if (!container) {
        console.error('container not found');
        return;
      }
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            const targetElement = container.querySelector(querySelector);
            if (targetElement) {
              if (stopWhenFoundOne ? !alreadyFoundOne : true) {
                alreadyFoundOne = true;
                callback && callback(targetElement);
              }
            } else {
              alreadyFoundOne = false;
            }
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      return observer;
    }

    observeElementRemoved(element, callback) {
      if (!element || !callback) return;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const removed of mutation.removedNodes) {
            if (removed === element || removed.contains(element)) {
              observer.disconnect();
              callback();
              return;
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return observer;
    }

    observeTargetElementsSeparately(containerToSearch = document.body, stopWhenFoundOne, querySelector, callback) {
      const container = containerToSearch;
      let alreadyFoundOne = false;
      if (!container) {
        console.error('container not found');
        return;
      }
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) {
                const inside = node.querySelectorAll?.(querySelector) || [];
                inside.forEach(el => {
                  if (stopWhenFoundOne ? !alreadyFoundOne : true) {
                    alreadyFoundOne = true;
                    callback(el);
                  }
                });
                
                if (node.matches?.(querySelector)) {
                  if (stopWhenFoundOne ? !alreadyFoundOne : true) {
                    alreadyFoundOne = true;
                    callback(node);
                  }
                }
              }
            }
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      return observer;
    }
  }

  window.Observer = Observer;
})(window);