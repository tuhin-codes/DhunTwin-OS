import type {
  Factory,
  Department,
  Machine,
} from "../types/digitalTwin";

export type {
  Factory,
  Department,
  Machine,
};

/*
 * Live factory data comes from the CarbonTwin backend.
 *
 * Backend flow:
 *
 * factory.json
 *     ↓
 * FactoryLoader
 *     ↓
 * MachineService
 *     ↓
 * DigitalTwinRuntime
 *     ↓
 * /machines/
 *     ↓
 * Socket.IO
 *     ↓
 * useMachines()
 *
 * This file is kept only for compatibility with older
 * frontend imports. It must not contain duplicate machine
 * data.
 */

export const factory: Factory = {
  id: "factory-001",
  name: "CarbonTwin Demo Plant",
  departments: [],
};

export const departments: Department[] = [];

export const machines: Machine[] = [];