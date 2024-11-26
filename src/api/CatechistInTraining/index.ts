import { AxiosResponse } from "axios";
import axiosInstances from "../../config/axios"

const request = axiosInstances.base


const ROOT_CATINTRAIN = "/catechist-in-trainings"



const createCatInTrain = (status: number): Promise<AxiosResponse<any>> =>
    request.post(`${ROOT_CATINTRAIN}`, {
        status

    });

    // const updateCatInTrain = (
    //     trainingListId: string,
    //     payload: { id: string; status: number }[]
    // ): Promise<AxiosResponse<any>> =>
    //     request.put(`${ROOT_CATINTRAIN}/${trainingListId}`, payload);            
    const updateCatInTrain = (
        trainingListId: string,
        payload: { id: string; status: number }[]
      ): Promise<AxiosResponse<any>> => {
        // Log URL và payload để debug
        console.log("API URL:", `${ROOT_CATINTRAIN}/${trainingListId}`);
        console.log("Payload gửi lên:", payload);
      
        return request
          .put(`${ROOT_CATINTRAIN}/${trainingListId}`, payload)
          .then((response) => {
            console.log("API Response:", response.data);
            return response;
          })
          .catch((error) => {
            console.error("Lỗi khi cập nhật Catechist:", error.response?.data || error.message);
            throw error;
          });
      };
      
const catInTrainApi = {
    createCatInTrain,
    updateCatInTrain,
};

export default catInTrainApi;
