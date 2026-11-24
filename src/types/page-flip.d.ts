// page-flip ships without type declarations; only the API the reader uses.
declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    loadFromHTML(items: HTMLElement[]): void;
    on(event: 'flip', callback: (event: { data: number }) => void): this;
    flipNext(): void;
    flipPrev(): void;
    turnToPage(index: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getCurrentPageIndex(): number;
    destroy(): void;
  }
}
