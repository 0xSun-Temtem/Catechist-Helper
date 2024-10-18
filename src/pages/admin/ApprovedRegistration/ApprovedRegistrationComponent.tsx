import React, { useState, useEffect } from "react";
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridRowSelectionModel,
} from "@mui/x-data-grid";
import Paper from "@mui/material/Paper";
import {
  Modal,
  Button,
  Select as MuiSelect,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
} from "@mui/material";
import viVNGridTranslation from "../../../locale/MUITable";
import Select from "react-select";
import dayjs from "dayjs";
import registrationApi from "../../../api/Registration";
import interviewApi from "../../../api/Interview";
import interviewProcessApi from "../../../api/InterviewProcess";
import accountApi from "../../../api/Account";
import { RegistrationItemResponse } from "../../../model/Response/Registration";
import { RegistrationStatus } from "../../../enums/Registration";
import sweetAlert from "../../../utils/sweetAlert";
import { formatDate } from "../../../utils/formatDate";
import { AccountRoleString } from "../../../enums/Account";

// Định dạng ngày và giờ
const formatDateTime = {
  DD_MM_YYYY_HH_mm: (date: string) => {
    return dayjs(date).format("DD/MM/YYYY, HH:mm");
  },
};

// Cấu hình các cột trong DataGrid
const columns: GridColDef[] = [
  { field: "fullName", headerName: "Tên đầy đủ", width: 180 },
  { field: "gender", headerName: "Giới tính", width: 100 },
  {
    field: "dateOfBirth",
    headerName: "Ngày sinh",
    width: 110,
    renderCell: (params) => {
      return formatDateTime.DD_MM_YYYY_HH_mm(params.value); // Format ngày tháng
    },
  },
  { field: "email", headerName: "Email", width: 200 },
  { field: "phone", headerName: "Số điện thoại", width: 120 },
  { field: "address", headerName: "Địa chỉ", width: 180 },
  {
    field: "isTeachingBefore",
    headerName: "Đã từng dạy",
    width: 120,
    renderCell: (params) => (params.value ? "Có" : "Không"),
  },
  { field: "yearOfTeaching", headerName: "Số năm giảng dạy", width: 150 },
  {
    field: "meetingTime",
    headerName: "Thời gian phỏng vấn",
    width: 180,
    renderCell: (params) => {
      return params.row.interviews.length > 0
        ? formatDateTime.DD_MM_YYYY_HH_mm(params.row.interviews[0].meetingTime)
        : "Chưa có lịch";
    },
    sortComparator: (a, b) => {
      if (!a || !b) return 0;
      return dayjs(a).isBefore(dayjs(b)) ? -1 : 1; // Sắp xếp theo ngày giờ từ sớm tới muộn
    },
  },
  {
    field: "recruiters",
    headerName: "Người phỏng vấn",
    width: 200,
    renderCell: (params) => {
      return params.row.recruiters
        .map((recruiter: any) => recruiter.fullName)
        .join(", ");
    },
  },
  {
    field: "status",
    headerName: "Trạng thái",
    width: 150,
    renderCell: (params) => {
      const status = params.value as RegistrationStatus;
      switch (status) {
        case RegistrationStatus.Approved_Duyet_Don:
          return (
            <span className="inline px-2 py-1 bg-info text-text_primary_dark rounded-lg">
              Chờ phỏng vấn
            </span>
          );
        case RegistrationStatus.Approved_Phong_Van:
          return (
            <span className="inline px-2 py-1 bg-success text-text_primary_light rounded-lg">
              Đã chấp nhận
            </span>
          );
        case RegistrationStatus.Rejected_Phong_Van:
          return (
            <span className="inline px-2 py-1 bg-danger rounded-lg text-text_primary_light">
              Bị từ chối
            </span>
          );
        default:
          return "Không xác định";
      }
    },
    // renderCell: () => {
    //   return (
    //     <span className="inline px-2 py-1 bg-info rounded-lg">
    //       Chờ phỏng vấn
    //     </span>
    //   );
    // },
  },
];

// Hàm chính để hiển thị danh sách đơn
export default function ApprovedRegistrationsTable() {
  const [rows, setRows] = useState<RegistrationItemResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 8,
  });
  const [rowCount, setRowCount] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedRegistrations, setSelectedRegistrations] =
    useState<GridRowSelectionModel>([]); // Chọn nhiều đơn

  // Modal state cho phê duyệt phỏng vấn
  const [openApprovalModal, setOpenApprovalModal] = useState<boolean>(false);
  const [interviewNote, setInterviewNote] = useState<string>(""); // Ghi chú phỏng vấn
  const [interviewResult, setInterviewResult] = useState<string>(""); // Kết quả phỏng vấn
  const [selectedRegistration, setSelectedRegistration] =
    useState<RegistrationItemResponse | null>(null); // Đơn đăng ký được chọn
  const [selectedRegistrationOfModal, setSelectedRegistrationOfModal] =
    useState<RegistrationItemResponse | null>(null);

  // Modal state cho cập nhật phỏng vấn
  const [openUpdateModal, setOpenUpdateModal] = useState<boolean>(false);
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [selectedRecruiters, setSelectedRecruiters] = useState<any[]>([]);
  const [meetingTime, setMeetingTime] = useState<string>("");
  const [recruiters, setRecruiters] = useState<any[]>([]); // Lưu danh sách recruiter
  const [updatedInterviewReason, setUpdatedInterviewReason] =
    useState<string>("");
  const [deletedInterviewReason, setDeletedInterviewReason] =
    useState<string>("");

  // State cho loại đơn hiện tại
  const [currentFilter, setCurrentFilter] = useState<
    "waiting" | "accepted" | "rejected"
  >("waiting");

  // Lấy danh sách accounts (recruiters)
  const fetchRecruiters = async () => {
    try {
      const { data } = await accountApi.getAllAccounts();
      setRecruiters(data.data.items);
    } catch (error) {
      console.error("Lỗi khi tải danh sách accounts:", error);
    }
  };

  // Fetch các đơn đã duyệt dựa trên trạng thái và lọc theo ngày
  const fetchApprovedRegistrations = async () => {
    try {
      setLoading(true);

      // Xác định giá trị status dựa trên bộ lọc hiện tại
      let status;
      switch (currentFilter) {
        case "accepted":
          status = RegistrationStatus.Approved_Phong_Van;
          break;
        case "rejected":
          status = RegistrationStatus.Rejected_Phong_Van;
          break;
        default:
          status = RegistrationStatus.Approved_Duyet_Don;
          break;
      }

      // Xác định ngày bắt đầu và kết thúc (lọc theo ngày nếu có selectedDate)
      const startDate = selectedDate ? selectedDate : undefined;
      const endDate = selectedDate ? selectedDate : undefined;

      // Gọi API getAllRegistrations với các tham số
      const { data } = await registrationApi.getAllRegistrations(
        startDate,
        endDate,
        status,
        paginationModel.page + 1, // Sử dụng paginationModel.page + 1 vì API có thể sử dụng số trang bắt đầu từ 1
        paginationModel.pageSize // Sử dụng kích thước trang từ paginationModel
      );

      // Cập nhật tổng số hàng
      setRowCount(data.data.total); // Cập nhật tổng số hàng từ API
      setRows(data.data.items); // Cập nhật hàng được trả về từ API
    } catch (error) {
      console.error("Lỗi khi tải danh sách registrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const element = document.querySelector<HTMLElement>(
    ".MuiTablePagination-selectLabel"
  );
  if (element) {
    element.innerHTML = "Số hàng mỗi trang";
  }

  // Gọi API khi component được render
  useEffect(() => {
    fetchApprovedRegistrations();
  }, [paginationModel, selectedDate, currentFilter]);

  // Xử lý khi thay đổi các lựa chọn trong bảng
  const handleSelectionChange = (newSelectionModel: GridRowSelectionModel) => {
    setSelectedRegistrations(newSelectionModel);
  };

  const fetchSelectedRegistrationOfModal = async () => {
    await registrationApi
      .getRegistrationById(selectedRegistrations[0].toString())
      .then((res) => {
        setSelectedRegistrationOfModal(res.data.data);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  // Mở modal phê duyệt phỏng vấn
  const handleOpenApprovalModal = (registrationId: string) => {
    const selectedRow = rows.find((row) => row.id === registrationId);
    if (selectedRow) {
      setSelectedRegistration(selectedRow);
      fetchSelectedRegistrationOfModal();
      setOpenApprovalModal(true);
    }
  };

  const handleCloseApprovalModal = () => {
    setSelectedRegistrationOfModal(null);
    setOpenApprovalModal(false);
    setInterviewNote(""); // Reset các trường input
    setInterviewResult("");
  };

  // Mở modal cập nhật phỏng vấn
  const handleOpenUpdateModal = (registrationId: string) => {
    const selectedRow = rows.find((row) => row.id === registrationId);
    if (selectedRow) {
      setSelectedRegistration(selectedRow);
      fetchSelectedRegistrationOfModal();
      setSelectedRecruiters(
        selectedRow.recruiters.map((recruiter: any) => ({
          value: recruiter.id,
          label: `${recruiter.fullName} ${recruiter.role && recruiter.role.roleName.toUpperCase() == AccountRoleString.ADMIN ? " - Admin" : ""} ${recruiter.role && recruiter.role.roleName.toUpperCase() == AccountRoleString.MANAGER ? " - Quản lý" : ""} ${recruiter.role && recruiter.role.roleName.toUpperCase() == AccountRoleString.CATECHIST ? " - Giáo lý viên" : ""}`,
        }))
      );
      setMeetingTime(
        selectedRow.interviews[0] ? selectedRow.interviews[0].meetingTime : ""
      );
      fetchRecruiters(); // Gọi API lấy danh sách recruiters
      setOpenUpdateModal(true);
    }
  };

  const handleCloseUpdateModal = () => {
    setSelectedRegistrationOfModal(null);
    setOpenUpdateModal(false);
    setSelectedRecruiters([]);
    setMeetingTime("");
  };

  // Mở modal cập nhật phỏng vấn
  const handleOpenDeleteModal = () => {
    fetchSelectedRegistrationOfModal();
    setOpenDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setSelectedRegistrationOfModal(null);
    setOpenDeleteModal(false);
  };

  // Xác nhận phỏng vấn
  const handleConfirmInterview = async () => {
    if (!interviewResult) {
      alert("Vui lòng chọn kết quả phỏng vấn.");
      return;
    }

    const isPassed = interviewResult === "Chấp nhận";
    const registrationStatus = isPassed
      ? RegistrationStatus.Approved_Phong_Van
      : RegistrationStatus.Rejected_Phong_Van;

    try {
      if (selectedRegistration) {
        await registrationApi.updateRegistration(selectedRegistration.id, {
          status: registrationStatus,
        });

        const interviewId = selectedRegistration.interviews[0]?.id;
        if (interviewId) {
          await interviewApi.updateInterview(interviewId, {
            meetingTime: selectedRegistration.interviews[0].meetingTime,
            note: interviewNote,
            isPassed,
          });
        }

        const interviewProcess = selectedRegistration.interviewProcesses.find(
          (process) => process.name === "Vòng phỏng vấn"
        );

        if (interviewProcess) {
          await interviewProcessApi.updateInterviewProcess(
            interviewProcess.id,
            {
              name: "Vòng phỏng vấn",
              status: isPassed ? 1 : 2,
            }
          );
        } else {
          await interviewProcessApi.createInterviewProcess({
            registrationId: selectedRegistration.id,
            name: "Vòng phỏng vấn",
          });
        }

        handleCloseApprovalModal();
        setSelectedRegistrations([]);
        sweetAlert.alertSuccess("Phê duyệt thành công", "", 1000, 20);
        fetchApprovedRegistrations();
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật phỏng vấn:", error);
    }
  };

  // Xác nhận cập nhật phỏng vấn
  const handleUpdateInterview = async () => {
    try {
      if (selectedRegistration) {
        await registrationApi.updateRegistration(selectedRegistration.id, {
          accounts: selectedRecruiters.map((rec: any) => rec.value),
          status: selectedRegistration.status, // Thêm status hiện tại để giữ nguyên
        });

        const interviewId = selectedRegistration.interviews[0]?.id;
        if (interviewId) {
          await interviewApi.updateInterview(interviewId, {
            meetingTime,
            note: selectedRegistration.interviews[0].note,
            isPassed: selectedRegistration.interviews[0].isPassed,
          });
        }

        handleCloseUpdateModal();
        sweetAlert.alertSuccess("Cập nhật thành công", "", 1000, 20);
        setSelectedRegistrations([]);
        fetchApprovedRegistrations();
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật phỏng vấn:", error);
    }
  };

  const handleDeleteInterview = async () => {
    if (selectedRegistrations.length === 0) return;

    for (let registrationId of selectedRegistrations) {
      const selectedRow = rows.find((row) => row.id === registrationId);

      if (!selectedRow || selectedRow.interviews.length === 0) {
        console.error("Không tìm thấy phỏng vấn để xóa.");
        continue;
      }

      const interviewId = selectedRow.interviews[0].id; // Lấy id của interview

      try {
        // Xóa interview của đơn đăng ký
        await interviewApi.deleteInterview(interviewId);

        // Cập nhật status của Interview Process
        const interviewProcessId = selectedRow.interviewProcesses[0]?.id;
        if (interviewProcessId) {
          await interviewProcessApi.updateInterviewProcess(interviewProcessId, {
            name: "Vòng duyệt đơn",
            status: 0, // Đặt lại trạng thái là 0
          });
        }

        // Cập nhật trạng thái đơn đăng ký thành Pending
        await registrationApi.updateRegistration(registrationId.toString(), {
          status: RegistrationStatus.Pending,
        });
        setSelectedRegistrations([]);
      } catch (error) {
        console.error("Lỗi khi xóa phỏng vấn:", error);
      }
    }

    // Tải lại danh sách sau khi xóa
    fetchApprovedRegistrations();
  };

  // Xử lý hiển thị các nút khi lọc
  const renderFilterButtons = () => {
    return (
      <div>
        {currentFilter !== "waiting" && (
          <button
            className="btn btn-info ml-1"
            onClick={() => setCurrentFilter("waiting")}
          >
            Đơn chờ phỏng vấn
          </button>
        )}
        {currentFilter !== "accepted" && (
          <button
            className="btn btn-success ml-1"
            onClick={() => setCurrentFilter("accepted")}
          >
            Đơn chấp nhận
          </button>
        )}
        {currentFilter !== "rejected" && (
          <button
            className="btn btn-danger ml-1"
            onClick={() => setCurrentFilter("rejected")}
          >
            Đơn từ chối
          </button>
        )}
      </div>
    );
  };

  // Vô hiệu hóa các hành động khi không ở trạng thái "waiting"
  const disableActions = currentFilter !== "waiting";

  return (
    <Paper
      sx={{
        width: "calc(100% - 3.8rem)",
        position: "absolute",
      }}
    >
      <h1 className="text-center text-[2.2rem] bg-info text-text_primary_dark py-2 font-bold">
        Danh sách phỏng vấn ứng viên
      </h1>

      <div className="flex justify-between items-center w-full my-3">
        {/* Chọn ngày filter */}
        <div className="flex justify-start px-3">
          <input
            type="date"
            className="w-[200px] py-2 px-2 border rounded-md"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          {renderFilterButtons()}
        </div>
        <div>
          {selectedRegistrations.length > 0 && !disableActions && (
            <div className="flex justify-end px-3">
              {selectedRegistrations.length === 1 && (
                <>
                  <button
                    className="btn btn-primary ml-1"
                    onClick={() =>
                      handleOpenApprovalModal(
                        selectedRegistrations[0].toString()
                      )
                    }
                  >
                    Phê duyệt phỏng vấn
                  </button>
                  <button
                    className="btn btn-warning ml-1"
                    onClick={() =>
                      handleOpenUpdateModal(selectedRegistrations[0].toString())
                    }
                  >
                    Cập nhật lịch phỏng vấn
                  </button>
                </>
              )}
              <button
                onClick={handleOpenDeleteModal}
                className="btn btn-danger ml-1"
              >
                Xóa lịch phỏng vấn
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-2">
        <DataGrid
          rows={rows}
          columns={columns}
          paginationMode="server"
          rowCount={rowCount} // Đảm bảo rowCount là tổng số hàng từ server
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} // Cập nhật paginationModel khi thay đổi
          pageSizeOptions={[8, 25, 50]}
          onRowSelectionModelChange={handleSelectionChange}
          rowSelectionModel={selectedRegistrations}
          checkboxSelection
          sx={{
            border: 0,
          }}
          localeText={viVNGridTranslation}
        />
      </div>

      {/* Modal phê duyệt phỏng vấn */}
      <Modal open={openApprovalModal} onClose={handleCloseApprovalModal}>
        <div
          style={{
            width: "50%",
            margin: "auto",
            backgroundColor: "white",
            borderRadius: "8px",
          }}
          className="py-5 px-5 mt-4"
        >
          <h1 className="text-center text-[2.2rem] text-primary py-2 pt-0 font-bold uppercase">
            Phê duyệt phỏng vấn
          </h1>

          {selectedRegistrationOfModal ? (
            <>
              <div className="flex flex-wrap mt-3">
                <h5 className="mt-2 w-[50%]">
                  <strong>Tên ứng viên:</strong>{" "}
                  {selectedRegistrationOfModal.fullName}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Thời gian phỏng vấn:</strong>{" "}
                  {formatDate.DD_MM_YYYY_Time(
                    selectedRegistrationOfModal.interviews[0].meetingTime
                  )}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Giới tính:</strong>{" "}
                  {selectedRegistrationOfModal.gender}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Ngày sinh:</strong>{" "}
                  {formatDate.DD_MM_YYYY(
                    selectedRegistrationOfModal.dateOfBirth
                  )}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Số điện thoại:</strong>{" "}
                  {selectedRegistrationOfModal.phone}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Email:</strong> {selectedRegistrationOfModal.email}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Kinh nghiệm:</strong>{" "}
                  {selectedRegistrationOfModal.isTeachingBefore
                    ? "Có"
                    : "Không"}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Số năm giảng dạy:</strong>{" "}
                  {selectedRegistrationOfModal.yearOfTeaching}
                </h5>
                <h5 className="mt-2 w-[100%]">
                  <strong>Địa chỉ:</strong>{" "}
                  {selectedRegistrationOfModal.address}
                </h5>
                <h5 className="mt-2 w-[100%]">
                  <strong>Người phỏng vấn:</strong>{" "}
                  {selectedRegistrationOfModal.recruiters
                    .map((recruiter: any) => recruiter.fullName)
                    .join(", ")}
                </h5>
              </div>
            </>
          ) : (
            <></>
          )}

          <h2 className="my-0 py-0 mt-3">
            <strong>Ghi chú phỏng vấn</strong>
          </h2>

          <TextField
            label="Ghi chú"
            fullWidth
            multiline
            rows={3}
            value={interviewNote}
            onChange={(e) => setInterviewNote(e.target.value)}
            placeholder="Nhập ghi chú phỏng vấn (không bắt buộc)"
            margin="normal"
            className="my-0 mt-1"
          />

          <FormControl fullWidth margin="normal" className="my-0 mt-4">
            <InputLabel id="result-label">
              <strong>Kết quả</strong>
            </InputLabel>
            <MuiSelect
              labelId="result-label"
              value={interviewResult}
              onChange={(e) => setInterviewResult(e.target.value)}
            >
              <MenuItem
                value="Chấp nhận"
                style={{ backgroundColor: "green", color: "white" }}
              >
                Chấp nhận
              </MenuItem>
              <MenuItem
                value="Từ chối"
                style={{ backgroundColor: "red", color: "white" }}
              >
                Từ chối
              </MenuItem>
            </MuiSelect>
          </FormControl>

          <div
            className="modal-buttons"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <Button
              onClick={handleConfirmInterview}
              variant="contained"
              color="primary"
            >
              Xác nhận
            </Button>
            <Button onClick={handleCloseApprovalModal} variant="outlined">
              Hủy bỏ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal cập nhật phỏng vấn */}
      <Modal open={openUpdateModal} onClose={handleCloseUpdateModal}>
        <div
          style={{
            width: "50%",
            margin: "auto",
            backgroundColor: "white",
            borderRadius: "8px",
          }}
          className="py-5 px-5 mt-4"
        >
          <h1 className="text-center text-[2.2rem] text-warning py-2 pt-0 font-bold uppercase">
            Cập nhật lịch phỏng vấn
          </h1>

          {selectedRegistrationOfModal ? (
            <>
              <div className="flex flex-wrap mt-3">
                <h5 className="mt-2 w-[50%]">
                  <strong>Tên ứng viên:</strong>{" "}
                  {selectedRegistrationOfModal.fullName}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Thời gian phỏng vấn:</strong>{" "}
                  {formatDate.DD_MM_YYYY_Time(
                    selectedRegistrationOfModal.interviews[0].meetingTime
                  )}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Giới tính:</strong>{" "}
                  {selectedRegistrationOfModal.gender}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Ngày sinh:</strong>{" "}
                  {formatDate.DD_MM_YYYY(
                    selectedRegistrationOfModal.dateOfBirth
                  )}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Số điện thoại:</strong>{" "}
                  {selectedRegistrationOfModal.phone}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Email:</strong> {selectedRegistrationOfModal.email}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Kinh nghiệm:</strong>{" "}
                  {selectedRegistrationOfModal.isTeachingBefore
                    ? "Có"
                    : "Không"}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Số năm giảng dạy:</strong>{" "}
                  {selectedRegistrationOfModal.yearOfTeaching}
                </h5>
                <h5 className="mt-2 w-[100%]">
                  <strong>Địa chỉ:</strong>{" "}
                  {selectedRegistrationOfModal.address}
                </h5>
                <h5 className="mt-2 w-[100%]">
                  <strong>Người phỏng vấn:</strong>{" "}
                  {selectedRegistrationOfModal.recruiters
                    .map((recruiter: any) => recruiter.fullName)
                    .join(", ")}
                </h5>
              </div>
            </>
          ) : (
            <></>
          )}

          {/* Cập nhật người phỏng vấn */}
          <FormControl fullWidth margin="normal">
            <label className="font-bold mt-1">Cập nhật người phỏng vấn</label>
            <Select
              options={recruiters.map((acc: any) => ({
                value: acc.id,
                label: `${acc.fullName} ${acc.role && acc.role.roleName.toUpperCase() == AccountRoleString.ADMIN ? " - Admin" : ""} ${acc.role && acc.role.roleName.toUpperCase() == AccountRoleString.MANAGER ? " - Quản lý" : ""} ${acc.role && acc.role.roleName.toUpperCase() == AccountRoleString.CATECHIST ? " - Giáo lý viên" : ""}`,
              }))}
              isMulti
              value={selectedRecruiters}
              onChange={(newValue: any) =>
                setSelectedRecruiters(
                  newValue as { value: string; label: string }[]
                )
              }
              placeholder="Tìm kiếm và chọn người phỏng vấn..."
              className="mt-1 z-[999]"
            />
          </FormControl>

          {/* Cập nhật thời gian phỏng vấn */}
          <TextField
            label="Cập nhật thời gian phỏng vấn"
            type="datetime-local"
            fullWidth
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
            margin="normal"
            InputLabelProps={{
              shrink: true,
            }}
          />

          <div className="mt-2">
            <h5 className="w-[100%] mb-1">
              <strong>Lý do cập nhật phỏng vấn</strong>
            </h5>
            <textarea
              name="updatedInterviewReason"
              onChange={(e) => {
                setUpdatedInterviewReason(e.target.value);
              }}
              className="block w-full p-2 border border-gray-700 rounded-lg"
            />
          </div>

          <div
            className="modal-buttons"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <Button
              onClick={handleUpdateInterview}
              variant="contained"
              color="warning"
            >
              Cập nhật
            </Button>
            <Button
              onClick={handleCloseUpdateModal}
              variant="outlined"
              color="warning"
            >
              Hủy bỏ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal xóa phỏng vấn */}
      <Modal open={openDeleteModal} onClose={handleCloseUpdateModal}>
        <div
          style={{
            width: "50%",
            margin: "auto",
            backgroundColor: "white",
            borderRadius: "8px",
          }}
          className="py-5 px-5 mt-4"
        >
          <h1 className="text-center text-[2.2rem] text-danger py-2 pt-0 font-bold uppercase">
            Xóa lịch phỏng vấn
          </h1>

          {selectedRegistrationOfModal ? (
            <>
              <div className="flex flex-wrap mt-3">
                <h5 className="mt-2 w-[50%]">
                  <strong>Tên ứng viên:</strong>{" "}
                  {selectedRegistrationOfModal.fullName}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Thời gian phỏng vấn:</strong>{" "}
                  {formatDate.DD_MM_YYYY_Time(
                    selectedRegistrationOfModal.interviews[0].meetingTime
                  )}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Giới tính:</strong>{" "}
                  {selectedRegistrationOfModal.gender}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Ngày sinh:</strong>{" "}
                  {formatDate.DD_MM_YYYY(
                    selectedRegistrationOfModal.dateOfBirth
                  )}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Số điện thoại:</strong>{" "}
                  {selectedRegistrationOfModal.phone}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Email:</strong> {selectedRegistrationOfModal.email}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Kinh nghiệm:</strong>{" "}
                  {selectedRegistrationOfModal.isTeachingBefore
                    ? "Có"
                    : "Không"}
                </h5>
                <h5 className="mt-2 w-[50%]">
                  <strong>Số năm giảng dạy:</strong>{" "}
                  {selectedRegistrationOfModal.yearOfTeaching}
                </h5>
                <h5 className="mt-2 w-[100%]">
                  <strong>Địa chỉ:</strong>{" "}
                  {selectedRegistrationOfModal.address}
                </h5>
                <h5 className="mt-2 w-[100%]">
                  <strong>Người phỏng vấn:</strong>{" "}
                  {selectedRegistrationOfModal.recruiters
                    .map((recruiter: any) => recruiter.fullName)
                    .join(", ")}
                </h5>
              </div>
            </>
          ) : (
            <></>
          )}

          <div className="mt-3">
            <h5 className="w-[100%] mb-1">
              <strong>Lý do xóa lịch phỏng vấn</strong>
            </h5>
            <textarea
              name="deletedInterviewReason"
              onChange={(e) => {
                setDeletedInterviewReason(e.target.value);
              }}
              className="block w-full p-2 border border-gray-700 rounded-lg"
            />
          </div>

          <div
            className="modal-buttons"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <Button
              onClick={handleDeleteInterview}
              variant="contained"
              color="error"
            >
              Xác nhận
            </Button>
            <Button
              onClick={handleCloseDeleteModal}
              variant="outlined"
              color="error"
            >
              Hủy bỏ
            </Button>
          </div>
        </div>
      </Modal>
    </Paper>
  );
}