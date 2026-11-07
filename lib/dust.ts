/** Small pooled pixel puffs, driven by the existing world clock. */
export function createFootDust(parent: HTMLElement) {
  const dots = Array.from({ length: 24 }, () => {
    const node = document.createElement("i");
    node.className = "foot-dust";
    node.style.width = node.style.height = "2px";
    node.hidden = true;
    parent.append(node);
    return { node, x: 0, y: 0, vx: 0, vy: 0, age: 1, life: 0.4, size: 4 };
  });
  let cursor = 0,
    clock = 0,
    lastDirection = 0;
  const burst = (x: number, y: number, direction: number, count = 3) => {
    for (let n = 0; n < count; n++) {
      const dot = dots[cursor++ % dots.length];
      Object.assign(dot, {
        x: x - direction * 20 + (n - 1) * 4,
        y: y - 3,
        vx: -direction * (20 + (cursor % 4) * 10),
        vy: -22 - (cursor % 3) * 9,
        age: 0,
        life: 0.28 + (cursor % 4) * 0.05,
        size: cursor % 2 ? 4 : 6,
      });
      dot.node.hidden = false;
    }
  };
  const clear = () => {
    clock = 0;
    lastDirection = 0;
    for (const dot of dots) {
      dot.age = 1;
      dot.node.hidden = true;
    }
  };
  return {
    get active() {
      return dots.some((dot) => dot.age < dot.life);
    },
    burst,
    clear,
    update(dt: number, x: number, y: number, speed: number, allowed: boolean) {
      if (!allowed) {
        clear();
        return;
      }
      if (Math.abs(speed) > 60) {
        const direction = Math.sign(speed);
        if (lastDirection && direction !== lastDirection)
          burst(x, y, lastDirection, 4);
        lastDirection = direction;
        clock += dt * Math.min(1.4, Math.abs(speed) / 400);
        if (clock > 0.16) {
          clock %= 0.16;
          burst(x, y, Math.sign(speed), 2);
        }
      } else {
        clock = 0;
        lastDirection = 0;
      }
      for (const dot of dots) {
        if (dot.age >= dot.life) {
          dot.node.hidden = true;
          continue;
        }
        dot.age += dt;
        dot.x += dot.vx * dt;
        dot.y += dot.vy * dt;
        dot.vy += 70 * dt;
        const size = Math.max(
          2,
          Math.ceil((dot.size * (1 - dot.age / dot.life)) / 2) * 2,
        );
        dot.node.style.transform = `translate(${Math.round(dot.x)}px,${Math.round(dot.y)}px) scale(${size / 2})`;
        dot.node.style.opacity = String(
          Math.max(0, 0.75 * (1 - dot.age / dot.life)),
        );
      }
    },
    destroy() {
      dots.forEach(({ node }) => node.remove());
    },
  };
}
