/**
 * Type definitions for ical.js library
 */

declare module 'ical.js' {
  export interface ICALTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    isDate: boolean;
    timezone: string;
    toJSDate(): Date;
  }

  export interface ICALProperty {
    name: string;
    type: string;
    getFirstValue(): any;
    getValues(): any[];
    toString(): string;
  }

  export interface ICALComponent {
    name: string;
    getAllSubcomponents(name: string): ICALComponent[];
    getFirstSubcomponent(name: string): ICALComponent | null;
    getFirstPropertyValue(name: string): any;
    getAllProperties(name?: string): ICALProperty[];
  }

  export class Component {
    constructor(jcalData: any);
    name: string;
    getAllSubcomponents(name: string): Component[];
    getFirstSubcomponent(name: string): Component | null;
    getFirstPropertyValue(name: string): any;
    getAllProperties(name?: string): ICALProperty[];
  }

  export class Event {
    constructor(component: Component);
    uid: string;
    summary: string;
    description: string;
    location: string;
    startDate: ICALTime;
    endDate: ICALTime;
    sequence: number;
    attendees: any[];
    component: Component;
  }

  export class Time {
    constructor(data?: any);
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    isDate: boolean;
    timezone: string;
    toJSDate(): Date;
    static fromJSDate(date: Date, useUTC?: boolean): Time;
  }

  export function parse(input: string): any;
  export function stringify(jcalData: any): string;

  export default {
    parse,
    stringify,
    Component,
    Event,
    Time,
  };
}