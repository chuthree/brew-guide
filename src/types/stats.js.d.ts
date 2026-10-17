declare module 'stats.js' {
  class Stats {
    dom: HTMLDivElement;
    showPanel(panel: number): void;
    begin(): void;
    end(): void;
    update(): void;
  }
  export default Stats;
}
