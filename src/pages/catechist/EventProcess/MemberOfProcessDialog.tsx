import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { DialogContent, DialogTitle, Button } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import memberApi from "../../../api/EventMember";
import eventApi from "../../../api/Event";
import roleEventApi from "../../../api/RoleEvent";
import { UpdateMemberRequest } from "../../../model/Request/EventMember";
import { RoleEventName } from "../../../enums/RoleEventEnum";
import useAppContext from "../../../hooks/useAppContext";
import {
  MemberOfProcessItemResponse,
  MemberItemResponse,
} from "../../../model/Response/Event";
import processApi from "../../../api/EventProcess";

interface MemberOfProcessDialogProps {
  eventId: string;
  processId: string;
}

export interface MemberOfProcessDialogHandle {
  handleChangeMemberOfProcess: (processId: string) => void;
}

const MemberOfProcessDialog = forwardRef<
  MemberOfProcessDialogHandle,
  MemberOfProcessDialogProps
>(({ eventId, processId }: MemberOfProcessDialogProps, ref) => {
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [membersOfProcess, setMembersOfProcess] = useState<
    (UpdateMemberRequest & {
      fullName: string;
      avatar: string;
      phone: string;
      isMain: boolean;
      email: string;
      gender: string;
    })[]
  >([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [mainMember, setMainMember] = useState<string>("");

  const { enableLoading, disableLoading } = useAppContext();

  useEffect(() => {
    const fetchAccountsAndRoles = async () => {
      enableLoading();
      try {
        let filteredAccounts: MemberOfProcessItemResponse[] = [];
        if (
          processId &&
          processId != null &&
          processId != undefined &&
          processId != ""
        ) {
          const getMemberProcessRes = await processApi.getMembersOfProcess(
            processId,
            processId,
            1,
            1000
          );
          filteredAccounts = getMemberProcessRes.data.data.items;
          const mainIdMember = filteredAccounts.find((item) => item.isMain)
            ?.getAccountResponse.id;
          setMainMember(mainIdMember ? mainIdMember : "");
        }

        // Fetch danh sách roles
        const roleResponse = await roleEventApi.getAllRoleEvents(1, 100);
        setRoles(roleResponse.data.data.items);

        // Fetch danh sách ban tổ chức hiện tại
        const organizerResponse = await eventApi.getEventMembers(
          eventId,
          1,
          10000
        );

        const currentOrganizers = organizerResponse.data.data.items.map(
          (item: MemberItemResponse) => {
            const memberItem = filteredAccounts.find(
              (member) => member.getAccountResponse.id == item.account.id
            );
            return {
              id: item.account.id,
              roleEventId: item.roleEvent.id,
              fullName: item.account.fullName,
              avatar: item.account.avatar,
              phone: item.account.phone,
              isMain: memberItem && memberItem.isMain ? true : false,
              email: item.account.email,
              gender: item.account.gender,
            };
          }
        );

        // Lọc các accounts chưa được thêm vào ban tổ chức
        const available = currentOrganizers.filter(
          (acc) =>
            !filteredAccounts.some(
              (org: MemberOfProcessItemResponse) =>
                org.getAccountResponse.id === acc.id
            )
        );

        const currentMembers = currentOrganizers.filter((acc) =>
          filteredAccounts.some(
            (org: MemberOfProcessItemResponse) =>
              org.getAccountResponse.id === acc.id
          )
        );

        setAvailableAccounts(available);
        setMembersOfProcess(currentMembers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        disableLoading();
      }
    };

    fetchAccountsAndRoles();
  }, [processId, eventId]);

  const handleChangeMemberOfProcess = async (processId: string) => {
    const request = membersOfProcess.map((item) => {
      return {
        id: item.id,
        isMain: item.id === mainMember,
      };
    });
    await memberApi.updateProcessMember(processId.trim(), request);
  };

  useImperativeHandle(ref, () => ({
    handleChangeMemberOfProcess,
  }));

  const handleRemoveMember = (accountId: string) => {
    const memberToRemove = membersOfProcess.find((org) => org.id === accountId);
    if (memberToRemove) {
      setMembersOfProcess((prev) => prev.filter((org) => org.id !== accountId));
      setAvailableAccounts((prev) => [...prev, memberToRemove]);
      if (memberToRemove.id == mainMember) {
        setMainMember("");
      }
    }
  };

  const handleAddMember = (accountId: string) => {
    const memberToAdd = availableAccounts.find((org) => org.id === accountId);
    if (memberToAdd) {
      setAvailableAccounts((prev) =>
        prev.filter((org) => org.id !== accountId)
      );
      setMembersOfProcess((prev) => [...prev, memberToAdd]);
    }
  };

  const getRoleOrder = (roleName: string): number => {
    switch (roleName) {
      case RoleEventName.TRUONG_BTC:
        return 1; // Thứ tự cao nhất
      case RoleEventName.PHO_BTC:
        return 2;
      case RoleEventName.MEMBER_BTC:
        return 3; // Thứ tự thấp nhất
      default:
        return 4; // Vai trò không xác định (nếu có)
    }
  };

  const sortedAvailables = [...availableAccounts].sort((a, b) => {
    const roleNameA = roles.find((r) => r.id === a.roleEventId)?.name || "";
    const roleNameB = roles.find((r) => r.id === b.roleEventId)?.name || "";
    return getRoleOrder(roleNameA) - getRoleOrder(roleNameB);
  });

  const sortedMembersOfProcess = [...membersOfProcess].sort((a, b) => {
    const roleNameA = roles.find((r) => r.id === a.roleEventId)?.name || "";
    const roleNameB = roles.find((r) => r.id === b.roleEventId)?.name || "";
    return getRoleOrder(roleNameA) - getRoleOrder(roleNameB);
  });

  const handleMainCatechistChange = (id: string) => {
    setMainMember(id);
  };

  return (
    <>
      <div>
        <DialogTitle>Thành viên đảm nhận</DialogTitle>
        <DialogContent>
          <h4>Danh sách Chưa Gán</h4>
          <DataGrid
            disableRowSelectionOnClick
            rows={sortedAvailables}
            columns={[
              {
                field: "avatar",
                headerName: "Ảnh",
                width: 100,
                renderCell: (params) => (
                  <img
                    src={params.row.avatar || "https://via.placeholder.com/50"}
                    alt="Avatar"
                    width={50}
                    height={50}
                    style={{ borderRadius: "3px" }}
                  />
                ),
              },
              { field: "fullName", headerName: "Họ và Tên", width: 200 },
              { field: "gender", headerName: "Giới tính", width: 105 },
              { field: "email", headerName: "Email", width: 200 },
              { field: "phone", headerName: "Số Điện Thoại", width: 150 },
              {
                field: "roleEventId",
                headerName: "Vai trò",
                width: 200,
                renderCell: (params) => {
                  const role = roles.find((r) => r.id === params.value);
                  return role ? role.name : "N/A";
                },
              },
              {
                field: "action",
                headerName: "Xóa",
                width: 150,
                renderCell: (params) => (
                  <Button
                    color="primary"
                    onClick={() => handleAddMember(params.row.id)}
                  >
                    Thêm
                  </Button>
                ),
              },
            ]}
            autoHeight
          />
          <h4 className="mt-3">Danh sách Ban Tổ Chức</h4>
          {sortedMembersOfProcess.length > 0 ? (
            <>
              <DataGrid
                disableRowSelectionOnClick
                rows={sortedMembersOfProcess}
                columns={[
                  {
                    field: "avatar",
                    headerName: "Ảnh",
                    width: 100,
                    renderCell: (params) => (
                      <img
                        src={
                          params.row.avatar || "https://via.placeholder.com/50"
                        }
                        alt="Avatar"
                        width={50}
                        height={50}
                        style={{ borderRadius: "3px" }}
                      />
                    ),
                  },
                  { field: "fullName", headerName: "Họ và Tên", width: 200 },
                  { field: "gender", headerName: "Giới tính", width: 105 },
                  { field: "email", headerName: "Email", width: 200 },
                  { field: "phone", headerName: "Số Điện Thoại", width: 150 },
                  {
                    field: "roleEventId",
                    headerName: "Vai trò",
                    width: 200,
                    renderCell: (params) => {
                      const role = roles.find((r) => r.id === params.value);
                      return role ? role.name : "N/A";
                    },
                  },
                  {
                    field: "main",
                    headerName: "Đảm nhận chính",
                    width: 150,
                    renderCell: (params) => (
                      <input
                        type="checkbox"
                        checked={mainMember === params.row.id}
                        onChange={() => {
                          handleMainCatechistChange(params.row.id);
                        }}
                      />
                    ),
                  },
                  {
                    field: "action",
                    headerName: "Xóa",
                    width: 150,
                    renderCell: (params) => (
                      <Button
                        color="error"
                        onClick={() => handleRemoveMember(params.row.id)}
                      >
                        Xóa
                      </Button>
                    ),
                  },
                ]}
                autoHeight
              />
            </>
          ) : (
            <p className="text-primary mt-2">Hiện tại chưa có ai</p>
          )}
        </DialogContent>
      </div>
    </>
  );
});

export default MemberOfProcessDialog;
