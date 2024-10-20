update UserSchedule
   set portId = Port.id
  from Port
 where UserSchedule.userId = Port.userId
   and UserSchedule.ditch = Port.ditch;