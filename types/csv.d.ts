declare module '*.csv' {
    interface CSVRecord {
        [key: string]: string | number | null;
    }
    const content: CSVRecord[];
    export default content;
} 