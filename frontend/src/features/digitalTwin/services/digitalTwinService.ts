import {
  getFactory,
  getMachines,
} from "../../../services/api";

export const digitalTwinService = {
  async getFactory() {
    return getFactory();
  },

  async getMachines() {
    return getMachines();
  },
};