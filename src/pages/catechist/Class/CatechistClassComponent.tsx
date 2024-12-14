import React, { useState, useEffect } from "react";
import Paper from "@mui/material/Paper";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Button, Dialog } from "@mui/material";
import pastoralYearApi from "../../../api/PastoralYear";
import catechistApi from "../../../api/Catechist";
import { getUserInfo } from "../../../utils/utils";
import { formatDate } from "../../../utils/formatDate";
import classApi from "../../../api/Class";
import sweetAlert from "../../../utils/sweetAlert";
import viVNGridTranslation from "../../../locale/MUITable";
import RequestLeaveDialog from "./RequestLeaveDialog";
import absenceApi from "../../../api/AbsenceRequest";
import { GetAbsenceItemResponse } from "../../../model/Response/AbsenceRequest";
import { ClassStatusEnum, ClassStatusString } from "../../../enums/Class";
import {
  CatechistInSlotTypeEnum,
  CatechistInSlotTypeEnumString,
} from "../../../enums/CatechistInSlot";

const CatechistClassComponent = () => {
  const [userLogin, setUserLogin] = useState<any>(null);
  const [pastoralYears, setPastoralYears] = useState<any[]>([]);
  const [selectedPastoralYear, setSelectedPastoralYear] = useState<string>("");
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedClassView, setSelectedClassView] = useState<any>(null);
  const [openSlotsDialog, setOpenSlotsDialog] = useState<boolean>(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [openLeaveDialog, setOpenLeaveDialog] = useState<boolean>(false);
  const [slotAbsenceId, setSlotAbsenceId] = useState<string>("");
  const [classViewSlotId, setClassViewSlotId] = useState<string>("");
  const [absenceList, setAbsenceList] = useState<GetAbsenceItemResponse[]>([]);

  // Fetch thông tin người dùng đã đăng nhập
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userLoggedin = getUserInfo(); // Hàm lấy thông tin người dùng đăng nhập
        setUserLogin(userLoggedin);
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };
    fetchUser();
  }, []);

  // Fetch danh sách niên khóa
  useEffect(() => {
    const fetchPastoralYears = async () => {
      try {
        const { data } = await pastoralYearApi.getAllPastoralYears();
        // Sắp xếp niên khóa theo năm từ mới nhất
        const sortedPastoralYears = data.data.items.sort((a: any, b: any) => {
          const yearA = parseInt(a.name.split("-")[0]);
          const yearB = parseInt(b.name.split("-")[0]);
          return yearB - yearA;
        });
        setPastoralYears(sortedPastoralYears);
        setSelectedPastoralYear(sortedPastoralYears[0]?.name || ""); // Mặc định chọn niên khóa đầu tiên
      } catch (error) {
        console.error("Error loading pastoral years:", error);
      }
    };
    fetchPastoralYears();
  }, []);

  // Fetch danh sách các lớp học của catechist
  useEffect(() => {
    const fetchClasses = async () => {
      if (userLogin && userLogin.catechistId && selectedPastoralYear) {
        setLoading(true);
        try {
          const response = await catechistApi.getCatechistClasses(
            userLogin.catechistId,
            selectedPastoralYear
          );
          console.log(userLogin.catechistId, selectedPastoralYear, response);

          let arr: any[] = [];

          // Sử dụng Promise.all để đợi tất cả các lời gọi API bất đồng bộ hoàn thành
          const fetchData = async () => {
            try {
              const promises = response.data.data.items.map(
                async (item: any) => {
                  const slotCount = await fetchSlotCountOfClass(item.class.id);
                  return {
                    ...item.class,
                    isMain: item.isMain,
                    slotCount: slotCount,
                  };
                }
              );

              // Đợi tất cả promises hoàn thành và trả về mảng kết quả
              arr = await Promise.all(promises);

              // Cập nhật state sau khi tất cả dữ liệu đã được lấy
              setClasses(arr);
            } catch (error) {
              console.error("Error fetching slot count:", error);
            }
          };

          // Gọi hàm fetchData để lấy dữ liệu
          fetchData();
          // Lưu danh sách lớp học vào state
        } catch (error) {
          console.error("Error fetching classes:", error);
        }
        setLoading(false);
      }
    };
    fetchClasses();
  }, [userLogin, selectedPastoralYear]); // Khi userLogin hoặc selectedPastoralYear thay đổi, gọi lại API
  console.log(classes);
  // Handle thay đổi niên khóa
  const handlePastoralYearChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setSelectedPastoralYear(event.target.value as string);
  };

  const fetchSlotCountOfClass = async (classId: string) => {
    try {
      const { data } = await classApi.getSlotsOfClass(classId, 1, 100);
      return data.data.total;
    } catch (error) {
      console.error("Error loading grades:", error);
      return "N/A";
    }
  };

  // Columns cho DataGrid
  const columns: GridColDef[] = [
    { field: "name", headerName: "Tên lớp", width: 200 },
    {
      field: "numberOfCatechist",
      headerName: "Số lượng giáo lý viên",
      width: 180,
    },
    // {
    //   field: "major",
    //   headerName: "Ngành",
    //   width: 150,
    //   renderCell: (params) => params.row.majorName,
    // },
    // {
    //   field: "grade",
    //   headerName: "Khối",
    //   width: 150,
    //   renderCell: (params) => params.row.gradeName,
    // },
    {
      field: "startDate",
      headerName: "Ngày bắt đầu",
      width: 180,
      renderCell: (params: any) => {
        return formatDate.DD_MM_YYYY(params.value);
      },
    },
    {
      field: "endDate",
      headerName: "Ngày kết thúc",
      width: 180,
      renderCell: (params: any) => {
        return formatDate.DD_MM_YYYY(params.value);
      },
    },
    {
      field: "classStatus",
      headerName: "Trạng thái",
      width: 180,
      renderCell: (params: any) => {
        switch (params.value) {
          case ClassStatusEnum.Active:
            return (
              <span className="rounded py-1 px-2 bg-warning text-black">
                {ClassStatusString.Active}
              </span>
            );
          case ClassStatusEnum.Finished:
            return (
              <span className="rounded py-1 px-2 bg-success text-white">
                {ClassStatusString.Finished}
              </span>
            );
          default:
            return <></>;
        }
      },
    },
    {
      field: "pastoralYearName",
      headerName: "Niên khóa",
      width: 180,
    },
    {
      field: "slotCount",
      headerName: "Tiết học",
      width: 180,
      renderCell: (params: any) => {
        return (
          <p>
            {params.row.slotCount <= 0 ? (
              <>Chưa có</>
            ) : (
              <Button
                variant="contained"
                color="info"
                onClick={() => {
                  setSelectedClassView(params.row);
                  handleViewSlots(params.row.id);
                  console.log(params.row);
                }}
              >
                Xem tiết học
              </Button>
            )}
          </p>
        );
      },
    },
    // { field: "majorName", headerName: "Ngành học", width: 180 },
    // { field: "gradeName", headerName: "Khối học", width: 180 },
  ];

  const fetchSlotForViewing = async (classId: string) => {
    const { data } = await classApi.getSlotsOfClass(classId);

    const sortedArray = data.data.items.sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const absenceRes = await absenceApi.getAbsences(
      undefined,
      userLogin.catechistId
    );
    setAbsenceList(absenceRes.data.data ?? []);
    console.log("aaaaaaaa", absenceRes.data.data);

    setSlots(sortedArray);
  };

  const handleViewSlots = async (classId: string) => {
    try {
      await fetchSlotForViewing(classId);
      setOpenSlotsDialog(true);
      setClassViewSlotId(classId);
    } catch (error) {
      console.error("Error loading slots:", error);
      sweetAlert.alertFailed(
        "Có lỗi xảy ra khi tải thông tin slot!",
        "",
        1000,
        22
      );
    }
  };

  useEffect(() => {
    if (!openSlotsDialog) {
      setClassViewSlotId("");
    }
  }, [openSlotsDialog]);

  const handleLeaveRequestSubmit = async (reason: string, slotId: string) => {
    try {
      console.log({
        catechistId: userLogin.catechistId,
        reason: reason,
        slotId: slotId,
      });
      const res = absenceApi.submitAbsence({
        catechistId: userLogin.catechistId,
        reason: reason,
        slotId: slotId,
      });
      console.log("res", res);

      // Đóng dialog
      // setOpenLeaveDialog(false);

      // Thông báo gửi yêu cầu thành công
      sweetAlert.alertSuccess(
        "Yêu cầu nghỉ phép đã được gửi thành công!",
        "",
        1000,
        22
      );
      setOpenLeaveDialog(false);
      if (classViewSlotId != "") {
        fetchSlotForViewing(classViewSlotId);
      }
    } catch (error) {
      console.error("Error loading slots:", error);
      sweetAlert.alertFailed("Có lỗi xảy ra khi gửi yêu cầu!", "", 1000, 22);
    } finally {
    }
  };

  return (
    <Paper
      sx={{
        width: "calc(100% - 3.8rem)",
        position: "absolute",
      }}
    >
      <h1 className="text-center text-[2.2rem] bg-primary_color text-text_primary_light py-2 font-bold">
        Thông tin lớp giáo lý
      </h1>
      <div className="w-full px-3">
        {/* Dropdown để chọn niên khóa */}
        <select
          value={selectedPastoralYear}
          className="py-1 px-2 border-gray-400 border-1 rounded mb-3 mt-3"
          onChange={handlePastoralYearChange}
        >
          {pastoralYears.map((year: any) => (
            <option key={year.name} value={year.name}>
              {year.name}
            </option>
          ))}
        </select>
        {/* DataGrid hiển thị danh sách lớp học */}
        <div style={{ height: 400, width: "100%" }}>
          <DataGrid
            rows={classes}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            localeText={viVNGridTranslation}
          />
        </div>
      </div>

      <Dialog
        fullWidth
        maxWidth="lg"
        open={openSlotsDialog}
        onClose={() => setOpenSlotsDialog(false)}
      >
        <div style={{ padding: "20px" }}>
          <h3>
            Thông tin các tiết học của{" "}
            {selectedClassView ? (
              <>
                <strong>{selectedClassView.name}</strong>
              </>
            ) : (
              <></>
            )}
          </h3>
          <DataGrid
            rows={slots}
            columns={[
              {
                field: "roomName",
                headerName: "Phòng học",
                width: 180,
                renderCell: (params) => (
                  <div className="flex">
                    <img
                      src={params.row.room.image ?? ""}
                      alt=""
                      width={50}
                      height={50}
                      className="my-1 border-1 border-gray-400"
                      style={{ borderRadius: "2px" }}
                    />
                    <p className="ml-2">{params.row.room.name}</p>
                  </div>
                ),
              },
              {
                field: "date",
                headerName: "Ngày học",
                width: 130,
                renderCell: (params) => formatDate.DD_MM_YYYY(params.row.date),
              },
              {
                field: "time",
                headerName: "Giờ học",
                width: 130,
                renderCell: (params) =>
                  formatDate.HH_mm(params.row.startTime) +
                  " - " +
                  formatDate.HH_mm(params.row.endTime),
              },
              {
                field: "catechists",
                headerName: "Giáo lý viên",
                width: 500,

                renderCell: (params) => {
                  const priority: Record<CatechistInSlotTypeEnum, number> = {
                    [CatechistInSlotTypeEnum.Main]: 1,
                    [CatechistInSlotTypeEnum.Assistant]: 2,
                    [CatechistInSlotTypeEnum.Substitute]: 3,
                  };

                  return params.row.catechistInSlots
                    ? params.row.catechistInSlots
                        .sort(
                          (
                            a: { type: CatechistInSlotTypeEnum },
                            b: { type: CatechistInSlotTypeEnum }
                          ) => priority[a.type] - priority[b.type]
                        )
                        .map((item: any) =>
                          item.catechist
                            ? item.catechist.code +
                              ` (${
                                CatechistInSlotTypeEnumString[
                                  CatechistInSlotTypeEnum[
                                    item.type as keyof typeof CatechistInSlotTypeEnum
                                  ]
                                ]
                              })`
                            : ""
                        )
                        .join(", ")
                    : "";
                },
              },

              {
                field: "action",
                headerName: "Hành động",
                width: 250,
                renderCell: (params: any) => {
                  return (
                    <>
                      {new Date().getTime() -
                        new Date(params.row.date).getTime() <
                      0 ? (
                        <>
                          {absenceList.length > 0 &&
                          absenceList.find(
                            (item) =>
                              item.slotId == params.row.id &&
                              item.catechistId == userLogin.catechistId
                          ) ? (
                            <>
                              <Button
                                color="secondary"
                                variant="contained"
                                onClick={() => {
                                  setSlotAbsenceId(params.row.id);
                                }} // Mở dialog khi nhấn
                              >
                                Xem nghỉ phép
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                color="secondary"
                                variant="outlined"
                                onClick={() => {
                                  setOpenLeaveDialog(true);
                                  setSlotAbsenceId(params.row.id);
                                }} // Mở dialog khi nhấn
                              >
                                Xin nghỉ phép
                              </Button>
                            </>
                          )}
                        </>
                      ) : (
                        <></>
                      )}
                    </>
                  );
                },
              },
              // {
              //   field: "mainCatechist",
              //   headerName: "Giáo lý viên chính",
              //   width: 200,
              // },
            ]}
            paginationMode="server"
            rowCount={slots.length}
            sx={{
              border: 0,
            }}
            localeText={viVNGridTranslation}
          />
        </div>
        <RequestLeaveDialog
          open={openLeaveDialog}
          slotId={slotAbsenceId}
          onClose={() => setOpenLeaveDialog(false)} // Đóng dialog
          onSubmit={handleLeaveRequestSubmit} // Hàm xử lý khi gửi yêu cầu nghỉ phép
        />
      </Dialog>
    </Paper>
  );
};

export default CatechistClassComponent;
