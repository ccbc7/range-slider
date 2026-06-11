import "./styles.css";

type RangeItem = {
  id: string;
  label: string;
  color: string;
};

type RangeSliderState = {
  items: RangeItem[];
  handles: number[];
};

type DisplayRange = RangeItem & {
  start: number;
  end: number;
  percent: number;
};

const MIN_RANGE_PERCENT = 1;
const MUNSELL_HUE_COLORS = [
  "#D84F5F", // 5R
  "#D97736", // 5YR
  "#C79B22", // 5Y
  "#89A83A", // 5GY
  "#3FA66B", // 5G
  "#2CA59A", // 5BG
  "#3A8CCB", // 5B
  "#6F75D8", // 5PB
  "#9B62C9", // 5P
  "#C4549A", // 5RP
];

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const appRoot = app;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHexColors(from: string, to: string, amount: number): string {
  const [fromRed, fromGreen, fromBlue] = hexToRgb(from);
  const [toRed, toGreen, toBlue] = hexToRgb(to);

  return rgbToHex(
    fromRed + (toRed - fromRed) * amount,
    fromGreen + (toGreen - fromGreen) * amount,
    fromBlue + (toBlue - fromBlue) * amount,
  );
}

function getMunsellHueColor(index: number): string {
  const goldenAngleStep = 0.38196601125;
  const position = ((index * goldenAngleStep) % 1) * MUNSELL_HUE_COLORS.length;
  const fromIndex = Math.floor(position) % MUNSELL_HUE_COLORS.length;
  const toIndex = (fromIndex + 1) % MUNSELL_HUE_COLORS.length;
  const amount = position - Math.floor(position);

  return mixHexColors(MUNSELL_HUE_COLORS[fromIndex], MUNSELL_HUE_COLORS[toIndex], amount);
}

// 先頭2領域 (A / B) は NEWONE のブランドカラー（黄・緑）に固定し、
// 3領域目以降は従来どおり色相環を踏襲する。
const NEWONE_FIXED_COLORS = ["#fdd000", "#00aebb"];

function getRangeColor(index: number): string {
  return NEWONE_FIXED_COLORS[index] ?? getMunsellHueColor(index);
}

let state: RangeSliderState = {
  items: [
    { id: "a", label: "A", color: getRangeColor(0) },
    { id: "b", label: "B", color: getRangeColor(1) },
  ],
  handles: [50],
};

function getDefaultLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `range-${Date.now()}-${Math.random()}`;
}

function createEvenHandles(itemCount: number): number[] {
  return Array.from({ length: itemCount - 1 }, (_, index) => {
    return Math.round(((index + 1) * 100) / itemCount);
  });
}

function toDisplayRanges(items: RangeItem[], handles: number[]): DisplayRange[] {
  const boundaries = [0, ...handles, 100];

  return items.map((item, index) => {
    const start = boundaries[index];
    const end = boundaries[index + 1];

    return {
      ...item,
      start,
      end,
      percent: end - start,
    };
  });
}

function clampHandle(index: number, nextValue: number, handles: number[], minRangePercent: number): number {
  const leftLimit = index === 0 ? minRangePercent : handles[index - 1] + minRangePercent;
  const rightLimit =
    index === handles.length - 1 ? 100 - minRangePercent : handles[index + 1] - minRangePercent;

  return Math.min(Math.max(nextValue, leftLimit), rightLimit);
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function addRange(): void {
  const nextItems = [
    ...state.items,
    {
      id: createId(),
      label: getDefaultLabel(state.items.length),
      color: getRangeColor(state.items.length),
    },
  ];

  state = {
    items: nextItems,
    handles: createEvenHandles(nextItems.length),
  };

  render();
}

function removeRange(itemId: string): void {
  if (state.items.length <= 2) {
    return;
  }

  const nextItems = state.items.filter((item) => item.id !== itemId);

  state = {
    items: nextItems,
    handles: createEvenHandles(nextItems.length),
  };

  render();
}

function updateHandle(index: number, nextValue: number): void {
  const nextHandles = [...state.handles];
  nextHandles[index] = clampHandle(index, nextValue, state.handles, MIN_RANGE_PERCENT);
  state = { ...state, handles: nextHandles };
  syncRangeViews();
}

function updateRangeLabel(itemId: string, label: string): void {
  state = {
    ...state,
    items: state.items.map((item) => {
      return item.id === itemId ? { ...item, label } : item;
    }),
  };
  syncRangeViews();
}

function getPercentFromPointer(event: PointerEvent, track: HTMLElement): number {
  const rect = track.getBoundingClientRect();
  const x = event.clientX - rect.left;
  return (x / rect.width) * 100;
}

function createRangeRow(range: DisplayRange): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "range-row";

  const color = document.createElement("span");
  color.className = "range-color";
  color.setAttribute("aria-hidden", "true");
  color.style.backgroundColor = range.color;

  const labelInput = document.createElement("input");
  labelInput.className = "range-name-input";
  labelInput.type = "text";
  labelInput.value = range.label;
  labelInput.setAttribute("aria-label", "領域名");
  labelInput.addEventListener("input", () => updateRangeLabel(range.id, labelInput.value));

  const percent = document.createElement("span");
  percent.className = "range-percent";
  percent.textContent = formatPercent(range.percent);

  const removeButton = document.createElement("button");
  removeButton.className = "icon-button remove-button";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.title = `${range.label} を削除`;
  removeButton.setAttribute("aria-label", `${range.label} を削除`);
  removeButton.addEventListener("click", () => removeRange(range.id));
  removeButton.toggleAttribute("disabled", state.items.length <= 2);

  row.append(color, labelInput, percent, removeButton);

  return row;
}

function createTrack(ranges: DisplayRange[]): HTMLElement {
  const track = document.createElement("div");
  track.className = "slider-track";
  track.setAttribute("aria-label", "配分スライダー");

  for (const range of ranges) {
    const segment = document.createElement("div");
    segment.className = "slider-segment";
    segment.style.left = `${range.start}%`;
    segment.style.width = `${range.percent}%`;
    segment.style.backgroundColor = range.color;

    const label = document.createElement("span");
    label.className = "segment-label";
    label.textContent = `${range.label} ${formatPercent(range.percent)}`;
    segment.append(label);
    track.append(segment);
  }

  state.handles.forEach((handle, index) => {
    const button = document.createElement("button");
    button.className = "slider-handle";
    button.type = "button";
    button.style.left = `${handle}%`;
    button.setAttribute("aria-label", `${index + 1}番目の境界`);
    button.setAttribute("aria-valuemin", "0");
    button.setAttribute("aria-valuemax", "100");
    button.setAttribute("aria-valuenow", String(handle));
    button.setAttribute("role", "slider");
    button.title = `${handle}%`;

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);

      const handleMove = (moveEvent: PointerEvent) => {
        updateHandle(index, getPercentFromPointer(moveEvent, track));
      };

      const stopDragging = () => {
        button.removeEventListener("pointermove", handleMove);
        button.removeEventListener("pointerup", stopDragging);
        button.removeEventListener("pointercancel", stopDragging);
      };

      button.addEventListener("pointermove", handleMove);
      button.addEventListener("pointerup", stopDragging);
      button.addEventListener("pointercancel", stopDragging);
    });

    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        updateHandle(index, state.handles[index] - 1);
      }

      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        updateHandle(index, state.handles[index] + 1);
      }
    });

    track.append(button);
  });

  return track;
}

function syncRangeViews(): void {
  const ranges = toDisplayRanges(state.items, state.handles);
  const segments = appRoot.querySelectorAll<HTMLElement>(".slider-segment");
  const handles = appRoot.querySelectorAll<HTMLButtonElement>(".slider-handle");
  const rangePercents = appRoot.querySelectorAll<HTMLElement>(".range-percent");
  const removeButtons = appRoot.querySelectorAll<HTMLButtonElement>(".remove-button");

  ranges.forEach((range, index) => {
    const segment = segments[index];
    const label = segment?.querySelector<HTMLElement>(".segment-label");
    const percentText = formatPercent(range.percent);

    if (segment) {
      segment.style.left = `${range.start}%`;
      segment.style.width = `${range.percent}%`;
    }

    if (label) {
      label.textContent = `${range.label} ${percentText}`;
    }

    if (rangePercents[index]) {
      rangePercents[index].textContent = percentText;
    }

    if (removeButtons[index]) {
      removeButtons[index].title = `${range.label} を削除`;
      removeButtons[index].setAttribute("aria-label", `${range.label} を削除`);
    }
  });

  state.handles.forEach((handle, index) => {
    const button = handles[index];

    if (!button) {
      return;
    }

    const roundedValue = Math.round(handle);
    button.style.left = `${handle}%`;
    button.setAttribute("aria-valuenow", String(roundedValue));
    button.title = `${roundedValue}%`;
  });
}

function render(): void {
  const ranges = toDisplayRanges(state.items, state.handles);

  appRoot.innerHTML = `
    <section class="workspace" aria-label="配分スライダー">
      <header class="toolbar">
        <p>${state.items.length} 領域 / ${state.handles.length} ハンドル</p>
      </header>
      <div class="slider-shell"></div>
      <div class="range-actions">
        <button class="add-button" type="button" title="領域を追加" aria-label="領域を追加">
          <span aria-hidden="true">＋</span>
          <span>増やす</span>
        </button>
      </div>
      <ol class="range-list" aria-label="領域一覧"></ol>
    </section>
  `;

  const shell = appRoot.querySelector<HTMLElement>(".slider-shell");
  const list = appRoot.querySelector<HTMLOListElement>(".range-list");
  const addButton = appRoot.querySelector<HTMLButtonElement>(".add-button");

  shell?.append(createTrack(ranges));
  ranges.forEach((range) => list?.append(createRangeRow(range)));
  addButton?.addEventListener("click", addRange);
}

render();
